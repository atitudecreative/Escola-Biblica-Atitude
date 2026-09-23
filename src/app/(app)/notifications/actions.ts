"use server";
import { z } from "zod";
import { refresh } from "next/cache";
import type { NotificationType } from "@prisma/client";
import { assertUser } from "@/server/auth/guards";
import { parseInput, runAction } from "@/server/action";
import { listNotifications, markRead } from "@/server/services/notifications";
import { saveNotificationPrefs } from "@/server/services/preferences";
import { NOTIFICATION_TYPE } from "@/lib/labels";

const TYPES = Object.keys(NOTIFICATION_TYPE) as [NotificationType, ...NotificationType[]];
const PAGE_SIZE = 20;

export async function loadMoreNotificationsAction(input: { cursor: string; unreadOnly: boolean; type: string | null }) {
  return runAction("notifications.more", async () => {
    const user = await assertUser();
    const data = parseInput(z.object({ cursor: z.string().min(1).max(40), unreadOnly: z.boolean(), type: z.enum(TYPES).nullable() }), input);
    const rows = await listNotifications(user.id, { cursor: data.cursor, unreadOnly: data.unreadOnly, types: data.type ? [data.type] : undefined, take: PAGE_SIZE + 1 });
    return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
  });
}

export async function markNotificationsAction(ids: string[] | null) {
  return runAction("notifications.mark", async () => {
    const user = await assertUser();
    await markRead(user.id, ids ? z.array(z.string().max(40)).max(200).parse(ids) : undefined);
    refresh();
  }, ids ? undefined : "Todas as notificações foram marcadas como lidas.");
}

export async function saveNotificationPrefsAction(input: unknown) {
  return runAction("notifications.prefs", async () => {
    const user = await assertUser();
    return saveNotificationPrefs(user.id, input);
  }, "Preferências salvas.");
}
