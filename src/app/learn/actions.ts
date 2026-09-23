"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { assertUser } from "@/server/auth/guards";
import { parseInput, runAction } from "@/server/action";
import { lessonAccess } from "@/server/services/access";
import { completeLesson, lockedLessonIds, recordProgress } from "@/server/services/learning";
import { saveAnswers, startAttempt, submitAssignment, submitAttempt, type AnswerInput } from "@/server/services/assessments";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { notify } from "@/server/services/notifications";

const id = z.string().min(10).max(40);

async function assertEnrolledAccess(lessonId: string) {
  const user = await assertUser();
  const access = await lessonAccess(user, lessonId);
  if (!access.allowed || !access.lesson) throw new ForbiddenError("Você não tem acesso a esta aula.");
  return { user, access };
}

export async function recordProgressAction(input: { lessonId: string; position: number; delta: number }) {
  return runAction("record_progress", async () => {
    const data = parseInput(z.object({ lessonId: id, position: z.number().min(0).max(86_400), delta: z.number().min(0).max(3600) }), input);
    const { user, access } = await assertEnrolledAccess(data.lessonId);
    if (!access.enrollment) return; // gestores/prévia não geram progresso
    await rateLimit("progress", 30, 60_000, user.id);
    await recordProgress(user.id, data.lessonId, Math.round(data.position), Math.round(data.delta));
  });
}

export async function completeLessonAction(lessonId: string) {
  return runAction("complete_lesson", async () => {
    const lid = parseInput(id, lessonId);
    const { user, access } = await assertEnrolledAccess(lid);
    if (!access.enrollment) throw new ForbiddenError("Matricule-se para registrar seu progresso.");
    const lesson = access.lesson!;
    if (lesson.type === "QUIZ" || lesson.type === "ASSIGNMENT") {
      throw new ForbiddenError("Esta aula é concluída ao ser aprovada na avaliação/atividade.");
    }
    const locked = await lockedLessonIds(lesson.courseId, user.id, lesson.course.sequential);
    if (locked.has(lid)) throw new ForbiddenError("Conclua as aulas anteriores primeiro.");
    const res = await completeLesson(user.id, lid);
    refresh();
    return res;
  });
}

export async function startQuizAction(quizId: string) {
  return runAction("start_quiz", async () => {
    const user = await assertUser();
    await startAttempt(user, parseInput(id, quizId));
    refresh();
  });
}

const answersSchema = z.record(z.string(), z.object({ selected: z.array(z.string()).max(20).optional(), text: z.string().max(5000).optional() }));

export async function saveQuizAction(input: { attemptId: string; answers: AnswerInput }) {
  return runAction("save_quiz", async () => {
    const user = await assertUser();
    const data = parseInput(z.object({ attemptId: id, answers: answersSchema }), input);
    await saveAnswers(user, data.attemptId, data.answers);
  });
}

export async function submitQuizAction(input: { attemptId: string; answers: AnswerInput }) {
  return runAction("submit_quiz", async () => {
    const user = await assertUser();
    const data = parseInput(z.object({ attemptId: id, answers: answersSchema }), input);
    const res = await submitAttempt(user, data.attemptId, data.answers);
    refresh();
    return { status: res.status, score: res.score, passed: res.passed };
  });
}

export async function submitAssignmentAction(input: { assignmentId: string; text?: string; fileId?: string | null }) {
  return runAction(
    "submit_assignment",
    async () => {
      const user = await assertUser();
      const data = parseInput(z.object({ assignmentId: id, text: z.string().max(20_000).optional(), fileId: id.nullable().optional() }), input);
      await rateLimit("assignment", 20, 60 * 60 * 1000, user.id);
      await submitAssignment(user, data);
      refresh();
    },
    "Atividade enviada! Você será avisado quando for corrigida.",
  );
}

export async function postCommentAction(input: { lessonId: string; body: string; parentId?: string | null }) {
  return runAction("post_comment", async () => {
    const data = parseInput(z.object({ lessonId: id, body: z.string().trim().min(2, "Escreva um comentário").max(2000), parentId: id.nullable().optional() }), input);
    const { user, access } = await assertEnrolledAccess(data.lessonId);
    await rateLimit("comment", 15, 10 * 60 * 1000, user.id);
    const muted = await db.user.findUnique({ where: { id: user.id }, select: { communityMutedUntil: true } });
    if (muted?.communityMutedUntil && muted.communityMutedUntil > new Date()) throw new ForbiddenError("Sua participação está temporariamente suspensa.");
    if (data.parentId) {
      const parent = await db.lessonComment.findUnique({ where: { id: data.parentId } });
      if (!parent || parent.lessonId !== data.lessonId) throw new NotFoundError();
      if (parent.userId !== user.id) {
        await notify(parent.userId, { type: "COMMUNITY", title: `${user.name} respondeu seu comentário`, body: data.body.slice(0, 120), link: `/learn/${access.lesson!.courseId}/${data.lessonId}#comentarios` });
      }
    }
    await db.lessonComment.create({ data: { lessonId: data.lessonId, userId: user.id, body: data.body, parentId: data.parentId ?? null } });
    refresh();
  });
}

export async function deleteCommentAction(commentId: string) {
  return runAction("delete_comment", async () => {
    const user = await assertUser();
    const c = await db.lessonComment.findUnique({ where: { id: parseInput(id, commentId) }, include: { lesson: { select: { course: { select: { instructorId: true } } } } } });
    if (!c) throw new NotFoundError();
    const moderator = user.permissions.has("courses.manage_any") || (user.permissions.has("community.moderate") && c.lesson.course.instructorId === user.id);
    if (c.userId !== user.id && !moderator) throw new ForbiddenError();
    await db.lessonComment.update({ where: { id: c.id }, data: { deletedAt: new Date() } });
    refresh();
  }, "Comentário removido.");
}
