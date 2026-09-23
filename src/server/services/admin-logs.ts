import "server-only";
import type { EmailStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertPermission } from "@/server/auth/guards";
import { NotFoundError } from "@/server/errors";

/** Consulta de auditoria, caixa de saída de e-mails e entregas de webhook. Permissão: audit.view. */

export type AuditFilters = { action?: string; actor?: string; from?: string; to?: string; q?: string };

function parseDay(v: string | undefined, endOfDay = false) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.action) where.action = f.action.endsWith(".*") ? { startsWith: f.action.slice(0, -1) } : f.action;
  if (f.actor === "system") where.actorId = null;
  else if (f.actor) where.actorId = f.actor;
  const from = parseDay(f.from);
  const to = parseDay(f.to, true);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (f.q)
    where.OR = [
      { actor: { name: { contains: f.q, mode: "insensitive" } } },
      { actor: { email: { contains: f.q, mode: "insensitive" } } },
      { entityId: { contains: f.q } },
      { ip: { contains: f.q } },
    ];
  return where;
}

export async function listAuditLogs(f: AuditFilters & { page: number; pageSize: number }) {
  await assertPermission("audit.view");
  const where = auditWhere(f);
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { actor: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);
  return { total, rows };
}

export async function auditFilterOptions() {
  await assertPermission("audit.view");
  const [actions, actors] = await Promise.all([
    db.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { action: "asc" } }),
    db.user.findMany({ where: { auditLogs: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
  ]);
  return { actions: actions.map((a) => a.action), actors };
}

/** Linhas para exportação CSV (limitadas para proteger o banco). */
export async function exportAuditLogs(f: AuditFilters, limit = 10_000) {
  await assertPermission("audit.view");
  return db.auditLog.findMany({
    where: auditWhere(f),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true, email: true } } },
  });
}

// ── E-mails ─────────────────────────────────────────

export async function listEmails(f: { q?: string; status?: string; template?: string; page: number; pageSize: number }) {
  await assertPermission("audit.view");
  const where: Prisma.EmailMessageWhereInput = {};
  if (f.q) where.OR = [{ to: { contains: f.q, mode: "insensitive" } }, { subject: { contains: f.q, mode: "insensitive" } }];
  if (f.status && ["QUEUED", "SENT", "FAILED", "LOGGED"].includes(f.status)) where.status = f.status as EmailStatus;
  if (f.template) where.template = f.template;
  const [total, rows, templates] = await Promise.all([
    db.emailMessage.count({ where }),
    db.emailMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: { id: true, to: true, subject: true, template: true, status: true, provider: true, error: true, createdAt: true, sentAt: true },
    }),
    db.emailMessage.groupBy({ by: ["template"], orderBy: { template: "asc" } }),
  ]);
  return { total, rows, templates: templates.map((t) => t.template) };
}

export async function getEmailContent(id: string) {
  await assertPermission("audit.view");
  const m = await db.emailMessage.findUnique({
    where: { id },
    select: { id: true, to: true, subject: true, text: true, template: true, status: true, provider: true, error: true, createdAt: true },
  });
  if (!m) throw new NotFoundError("E-mail não encontrado.");
  return m;
}
