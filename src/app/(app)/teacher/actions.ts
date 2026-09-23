"use server";
import { refresh } from "next/cache";
import { runAction } from "@/server/action";
import { assertPermission, assertUser } from "@/server/auth/guards";
import { sendAnnouncement } from "@/server/services/announcements";
import { createLesson } from "@/server/services/course-builder";

export async function sendAnnouncementAction(input: unknown) {
  return runAction(
    "teacher.send_announcement",
    async () => {
      const user = await assertPermission("announcements.course", "announcements.all");
      const a = await sendAnnouncement(user, input);
      refresh();
      return { recipients: a.recipients };
    },
    "Comunicado enviado.",
  );
}

/** Atalho do painel: cria aula/atividade no curso escolhido e devolve o id para abrir o editor. */
export async function quickCreateLessonAction(input: unknown) {
  return runAction("teacher.quick_lesson", async () => {
    const user = await assertUser();
    const lesson = await createLesson(user, input);
    return { courseId: lesson.courseId, lessonId: lesson.id };
  });
}
