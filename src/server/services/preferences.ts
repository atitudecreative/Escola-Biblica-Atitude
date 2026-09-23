import "server-only";
import { z } from "zod";
import type { NotificationType, Prisma } from "@prisma/client";
import { db } from "@/server/db";

/**
 * Preferências de notificação por tipo, guardadas em User.preferences.notifications.
 * Outras chaves de User.preferences (ex.: preferências do perfil) são preservadas.
 *
 *  - inApp: cria a notificação interna (sino / central)
 *  - email: envia e-mail quando o tipo tem entrega por e-mail
 *
 * Tipos não configurados caem no padrão (tudo ligado). SYSTEM é sempre entregue.
 */

/** Tipos configuráveis, na ordem em que aparecem no painel. */
export const CONFIGURABLE_TYPES = [
  "MESSAGE",
  "ANNOUNCEMENT",
  "COMMUNITY",
  "NEW_LESSON",
  "COURSE",
  "NEW_ASSIGNMENT",
  "ASSIGNMENT_GRADED",
  "QUIZ_GRADED",
  "CERTIFICATE",
  "ACHIEVEMENT",
] as const satisfies readonly NotificationType[];

/** Tipos que hoje têm entrega por e-mail (template existente). Os demais são só internos. */
export const EMAIL_CAPABLE_TYPES: readonly NotificationType[] = ["ANNOUNCEMENT", "ASSIGNMENT_GRADED", "CERTIFICATE"];

export type ChannelPrefs = { inApp: boolean; email: boolean };
export type NotificationPrefs = Record<(typeof CONFIGURABLE_TYPES)[number], ChannelPrefs>;

const channel = z.object({ inApp: z.boolean(), email: z.boolean() });
export const notificationPrefsSchema = z.object(
  Object.fromEntries(CONFIGURABLE_TYPES.map((t) => [t, channel.optional()])) as Record<(typeof CONFIGURABLE_TYPES)[number], z.ZodOptional<typeof channel>>,
);

const DEFAULT: ChannelPrefs = { inApp: true, email: true };

function readPrefs(raw: Prisma.JsonValue | null | undefined): NotificationPrefs {
  const stored = (raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>).notifications : null) ?? {};
  const out = {} as NotificationPrefs;
  for (const t of CONFIGURABLE_TYPES) {
    const v = (stored as Record<string, Partial<ChannelPrefs> | undefined>)[t];
    out[t] = { inApp: v?.inApp ?? DEFAULT.inApp, email: v?.email ?? DEFAULT.email };
  }
  return out;
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  return readPrefs(user?.preferences);
}

export async function saveNotificationPrefs(userId: string, input: unknown): Promise<NotificationPrefs> {
  const parsed = notificationPrefsSchema.parse(input);
  const user = await db.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const current = readPrefs(user?.preferences);
  const next = { ...current };
  for (const t of CONFIGURABLE_TYPES) if (parsed[t]) next[t] = parsed[t]!;
  const base = user?.preferences && typeof user.preferences === "object" && !Array.isArray(user.preferences) ? (user.preferences as Record<string, unknown>) : {};
  await db.user.update({ where: { id: userId }, data: { preferences: { ...base, notifications: next } as Prisma.InputJsonValue } });
  return next;
}

function isConfigurable(type: NotificationType): type is (typeof CONFIGURABLE_TYPES)[number] {
  return (CONFIGURABLE_TYPES as readonly string[]).includes(type);
}

/** Filtra, em uma única consulta, quem aceita receber `type` pelo canal indicado. */
export async function filterRecipients(userIds: string[], type: NotificationType, via: keyof ChannelPrefs): Promise<string[]> {
  if (!userIds.length || !isConfigurable(type)) return userIds;
  const rows = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, preferences: true } });
  const blocked = new Set(rows.filter((r) => !readPrefs(r.preferences)[type][via]).map((r) => r.id));
  return userIds.filter((id) => !blocked.has(id));
}

/** Conveniência para quem envia e-mails transacionais (certificado, correção...). */
export async function wantsEmail(userId: string, type: NotificationType) {
  return (await filterRecipients([userId], type, "email")).length > 0;
}
