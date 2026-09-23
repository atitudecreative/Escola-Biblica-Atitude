"use server";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { assertPermission, assertUser } from "@/server/auth/guards";
import { parseInput, runAction } from "@/server/action";
import { enroll, nextLessonFor } from "@/server/services/learning";
import { toggleFavorite } from "@/server/services/favorites";
import { ForbiddenError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";

const id = z.string().min(10).max(40);

export async function enrollAction(courseId: string) {
  const result = await runAction("enroll", async () => {
    const user = await assertPermission("learning.access");
    const cid = parseInput(id, courseId);
    await enroll(user, cid);
    return nextLessonFor(user.id, cid);
  });
  if (result.ok) {
    revalidatePath("/dashboard");
    redirect(result.data ? `/learn/${courseId}/${result.data}` : "/my-courses");
  }
  return result;
}

export async function toggleFavoriteAction(input: { type: "COURSE" | "LESSON" | "MATERIAL"; id: string }) {
  return runAction("toggle_favorite", async () => {
    const user = await assertUser();
    const data = parseInput(z.object({ type: z.enum(["COURSE", "LESSON", "MATERIAL"]), id }), input);
    const on = await toggleFavorite(user.id, data.type, data.id);
    revalidatePath("/favorites");
    return on;
  });
}

const reviewSchema = z.object({
  courseId: id,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function reviewCourseAction(input: z.infer<typeof reviewSchema>) {
  return runAction(
    "review_course",
    async () => {
      const user = await assertUser();
      const data = parseInput(reviewSchema, input);
      await rateLimit("review", 10, 60 * 60 * 1000, user.id);
      const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: data.courseId } } });
      if (!enrollment || enrollment.status === "CANCELLED") throw new ForbiddenError("Apenas alunos matriculados podem avaliar o curso.");
      await db.courseReview.upsert({
        where: { courseId_userId: { courseId: data.courseId, userId: user.id } },
        create: { courseId: data.courseId, userId: user.id, rating: data.rating, comment: data.comment || null },
        update: { rating: data.rating, comment: data.comment || null },
      });
      const agg = await db.courseReview.aggregate({ where: { courseId: data.courseId }, _avg: { rating: true }, _count: true });
      await db.course.update({ where: { id: data.courseId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
      refresh();
    },
    "Obrigado pela sua avaliação!",
  );
}
