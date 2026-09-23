import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertPermission } from "@/server/auth/guards";
import { NotFoundError, ValidationError } from "@/server/errors";
import { parseInput, zodFieldErrors } from "@/server/action";
import { env, isProd } from "@/server/env";
import { saveSettings, settingsSchemas, type SettingsGroup } from "@/server/settings";
import { deliverWebhook, WEBHOOK_EVENTS } from "./webhooks";
import type { Permission } from "@/lib/permissions";

/** Configurações da plataforma, sessões e webhooks. */

const GROUP_PERMISSION: Record<SettingsGroup, Permission> = {
  general: "settings.manage",
  appearance: "settings.manage",
  users: "settings.manage",
  courses: "settings.manage",
  communication: "settings.manage",
  security: "settings.manage",
  integrations: "settings.manage",
  home: "banners.manage",
  footer: "banners.manage",
};

export async function saveSettingsGroup(group: SettingsGroup, value: unknown) {
  const actor = await assertPermission(GROUP_PERMISSION[group]);
  const parsed = settingsSchemas[group].safeParse(value);
  if (!parsed.success) throw new ValidationError(undefined, zodFieldErrors(parsed.error));
  if (group === "home") await assertFeaturedCourses((parsed.data as { featuredCourseIds: string[] }).featuredCourseIds);
  if (group === "general") {
    const logo = (parsed.data as { logoUrl: string | null }).logoUrl;
    if (logo && !/^\/api\/files\/[A-Za-z0-9_-]+$/.test(logo)) throw new ValidationError(undefined, { logoUrl: "Envie o logo pelo campo de upload" });
  }
  if (group === "footer") {
    const f = parsed.data as { links: { href: string }[]; instagram: string; youtube: string };
    const errs: Record<string, string> = {};
    f.links.forEach((l, i) => {
      if (!isSafeHref(l.href)) errs[`links.${i}.href`] = "Use um caminho interno (/rota) ou https://";
    });
    for (const k of ["instagram", "youtube"] as const) if (f[k] && !isHttps(f[k])) errs[k] = "Use um endereço https://";
    if (Object.keys(errs).length) throw new ValidationError(undefined, errs);
  }
  const saved = await saveSettings(group, parsed.data, actor.id);
  await audit("settings.updated", { actorId: actor.id, entityType: "setting", entityId: group });
  return saved;
}

function isHttps(v: string) {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}
function isSafeHref(v: string) {
  if (v.startsWith("/")) return !v.startsWith("//") && !v.startsWith("/\\");
  return isHttps(v);
}

async function assertFeaturedCourses(ids: string[]) {
  if (!ids.length) return;
  const found = await db.course.count({ where: { id: { in: ids }, status: "PUBLISHED" } });
  if (found !== new Set(ids).size) throw new ValidationError("Alguns cursos em destaque não estão mais publicados. Revise a seleção.");
}

export function emailProviderInfo() {
  const provider = env.EMAIL_PROVIDER;
  const configured = provider === "log" || (provider === "resend" ? !!env.RESEND_API_KEY : !!env.SMTP_URL);
  return { provider, from: env.EMAIL_FROM, configured };
}

// ── Sessões ─────────────────────────────────────────

export async function listActiveSessions(take = 50) {
  await assertPermission("settings.manage");
  const where = { revokedAt: null, expiresAt: { gt: new Date() } };
  const [total, rows] = await Promise.all([
    db.session.count({ where }),
    db.session.findMany({
      where,
      orderBy: { lastUsedAt: "desc" },
      take,
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
  ]);
  return { total, rows };
}

export async function revokeSession(sessionId: string) {
  const actor = await assertPermission("settings.manage");
  if (sessionId === actor.sessionId) throw new ValidationError("Esta é a sua sessão atual. Use \"Sair\" no menu do usuário.");
  const s = await db.session.findUnique({ where: { id: sessionId }, select: { id: true, userId: true, revokedAt: true } });
  if (!s || s.revokedAt) throw new NotFoundError("Sessão não encontrada ou já encerrada.");
  await db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await audit("session.revoked", { actorId: actor.id, entityType: "user", entityId: s.userId, metadata: { sessionId } });
}

// ── Webhooks ────────────────────────────────────────

const EVENT_KEYS = WEBHOOK_EVENTS.map((e) => e.key) as [string, ...string[]];

const webhookUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      if (u.protocol === "https:") return true;
      // Em desenvolvimento aceitamos http://localhost para testes locais.
      return !isProd && u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname);
    } catch {
      return false;
    }
  }, "Use um endereço https:// válido");

export const webhookInput = z.object({
  id: z.string().optional(),
  url: webhookUrl,
  events: z.array(z.enum(EVENT_KEYS)).min(1, "Escolha ao menos um evento"),
  isActive: z.boolean().default(true),
});

function newSecret() {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export async function listWebhooks() {
  await assertPermission("settings.manage");
  const endpoints = await db.webhookEndpoint.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      secret: true,
      _count: { select: { deliveries: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 1, select: { statusCode: true, error: true, createdAt: true } },
    },
  });
  // O segredo nunca sai do servidor: exibimos só um sufixo para identificação.
  return endpoints.map(({ secret, deliveries, ...e }) => ({ ...e, secretHint: `…${secret.slice(-4)}`, last: deliveries[0] ?? null }));
}

export async function saveWebhook(input: unknown) {
  const actor = await assertPermission("settings.manage");
  const w = parseInput(webhookInput, input);
  if (w.id) {
    const res = await db.webhookEndpoint.updateMany({ where: { id: w.id }, data: { url: w.url, events: w.events, isActive: w.isActive } });
    if (!res.count) throw new NotFoundError("Endpoint não encontrado.");
    await audit("webhook.updated", { actorId: actor.id, entityType: "webhook", entityId: w.id, metadata: { url: w.url, events: w.events } });
    return { id: w.id, secret: null as string | null };
  }
  const secret = newSecret();
  const ep = await db.webhookEndpoint.create({ data: { url: w.url, events: w.events, isActive: w.isActive, secret } });
  await audit("webhook.created", { actorId: actor.id, entityType: "webhook", entityId: ep.id, metadata: { url: w.url, events: w.events } });
  return { id: ep.id, secret };
}

export async function rotateWebhookSecret(id: string) {
  const actor = await assertPermission("settings.manage");
  const secret = newSecret();
  const res = await db.webhookEndpoint.updateMany({ where: { id }, data: { secret } });
  if (!res.count) throw new NotFoundError("Endpoint não encontrado.");
  await audit("webhook.secret_rotated", { actorId: actor.id, entityType: "webhook", entityId: id });
  return secret;
}

export async function deleteWebhook(id: string) {
  const actor = await assertPermission("settings.manage");
  const ep = await db.webhookEndpoint.findUnique({ where: { id }, select: { url: true } });
  if (!ep) throw new NotFoundError("Endpoint não encontrado.");
  await db.webhookEndpoint.delete({ where: { id } });
  await audit("webhook.deleted", { actorId: actor.id, entityType: "webhook", entityId: id, metadata: { url: ep.url } });
}

export async function sendTestWebhook(id: string) {
  const actor = await assertPermission("settings.manage");
  const ep = await db.webhookEndpoint.findUnique({ where: { id } });
  if (!ep) throw new NotFoundError("Endpoint não encontrado.");
  const d = await deliverWebhook(ep, "webhook.test", {
    message: "Entrega de teste enviada pelo painel de administração.",
    triggeredBy: actor.id,
  });
  await audit("webhook.tested", { actorId: actor.id, entityType: "webhook", entityId: id, metadata: { statusCode: d.statusCode } });
  return { statusCode: d.statusCode, error: d.error, ok: !!d.statusCode && d.statusCode >= 200 && d.statusCode < 300 };
}

export async function listWebhookDeliveries(opts: { endpointId?: string; page: number; pageSize: number; status?: string }) {
  await assertPermission("settings.manage", "audit.view");
  const where = {
    ...(opts.endpointId ? { endpointId: opts.endpointId } : {}),
    ...(opts.status === "ok" ? { statusCode: { gte: 200, lt: 300 } } : {}),
    ...(opts.status === "fail" ? { OR: [{ statusCode: null }, { statusCode: { lt: 200 } }, { statusCode: { gte: 300 } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.webhookDelivery.count({ where }),
    db.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      select: { id: true, event: true, statusCode: true, error: true, createdAt: true, payload: true, endpoint: { select: { id: true, url: true } } },
    }),
  ]);
  return { total, rows };
}
