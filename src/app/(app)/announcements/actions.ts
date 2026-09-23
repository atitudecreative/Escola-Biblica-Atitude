"use server";
import { z } from "zod";
import { refresh } from "next/cache";
import { assertPermission } from "@/server/auth/guards";
import { runAction } from "@/server/action";
import { rateLimit } from "@/server/rate-limit";
import { sendAnnouncement } from "@/server/services/announcements";
import { countAudience, searchAnnouncementTargets } from "@/server/services/announcement-audience";
import type { AnnouncementInput } from "@/lib/validation/teacher";

export async function countAudienceAction(input: AnnouncementInput) {
  return runAction("announcements.count", async () => {
    const user = await assertPermission("announcements.all", "announcements.course");
    return countAudience(user, input);
  });
}

export async function searchTargetsAction(q: string) {
  return runAction("announcements.targets", async () => {
    const user = await assertPermission("announcements.all");
    return searchAnnouncementTargets(user, z.string().max(80).parse(q));
  });
}

export async function sendAnnouncementAction(input: AnnouncementInput) {
  return runAction(
    "announcements.send",
    async () => {
      const user = await assertPermission("announcements.all", "announcements.course");
      await rateLimit("announcements.send", 10, 60 * 60_000, user.id);
      const a = await sendAnnouncement(user, input);
      refresh();
      return { id: a.id, recipients: a.recipients };
    },
    "Comunicado enviado.",
  );
}
