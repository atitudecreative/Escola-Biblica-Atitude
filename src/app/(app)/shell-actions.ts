"use server";
import { assertUser } from "@/server/auth/guards";
import { runAction } from "@/server/action";
import { globalSearch } from "@/server/services/search";
import { listNotifications, markRead } from "@/server/services/notifications";
import { refresh } from "next/cache";
import { z } from "zod";

export async function quickSearchAction(q: string) {
  return runAction("quick_search", async () => {
    const user = await assertUser();
    return globalSearch(user, z.string().max(100).parse(q), 4);
  });
}

export async function recentNotificationsAction() {
  return runAction("recent_notifications", async () => {
    const user = await assertUser();
    return listNotifications(user.id, { take: 8 });
  });
}

export async function markNotificationsReadAction(ids?: string[]) {
  return runAction("mark_notifications_read", async () => {
    const user = await assertUser();
    await markRead(user.id, ids ? z.array(z.string()).max(100).parse(ids) : undefined);
    refresh();
  });
}
