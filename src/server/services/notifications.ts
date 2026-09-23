import "server-only";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import type { NotificationType } from "@prisma/client";
import { filterRecipients } from "./preferences";

type NotifyInput = { type: NotificationType; title: string; body?: string; link?: string };

/**
 * Cria notificações internas (em lote). Nunca derruba a operação que a originou.
 * Respeita as preferências do usuário (services/preferences.ts): quem desligou
 * o canal interno para o tipo não recebe.
 */
export async function notify(userIds: string | string[], input: NotifyInput) {
  let ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (!ids.length) return 0;
  try {
    ids = await filterRecipients(ids, input.type, "inApp");
    if (!ids.length) return 0;
    const res = await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...input })) });
    return res.count;
  } catch (error) {
    logger.error("notifications.create_failed", { error, category: "infra" });
    return 0;
  }
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(
  userId: string,
  opts: { take?: number; unreadOnly?: boolean; cursor?: string; types?: NotificationType[] } = {},
) {
  return db.notification.findMany({
    where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}), ...(opts.types?.length ? { type: { in: opts.types } } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts.take ?? 20,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
}

export async function markRead(userId: string, ids?: string[]) {
  await db.notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}
