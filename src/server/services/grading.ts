import "server-only";
import type { Prisma, SubmissionStatus } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { parseInput } from "@/server/action";
import { sendEmail } from "@/server/email";
import { getSettings } from "@/server/settings";
import type { SessionUser } from "@/server/auth/session";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { SUBMISSION_STATUS } from "@/lib/labels";
import { gradeAttemptSchema, gradeSubmissionSchema } from "@/lib/validation/teacher";
import { notify } from "./notifications";
import { completeLesson } from "./learning";
import { awardXp } from "./gamification";
import { logger } from "@/server/logger";

/**
 * Correção de atividades e questionários com questões abertas.
 * Quem corrige: `grading.own` no curso de que é professor, ou `courses.manage_any`.
 */

export function gradingCourseScope(user: SessionUser): Prisma.CourseWhereInput {
  if (user.permissions.has("courses.manage_any")) return {};
  if (user.permissions.has("grading.own")) return { instructorId: user.id };
  return { id: "__none__" };
}

function canGrade(user: SessionUser, course: { instructorId: string }) {
  if (user.permissions.has("courses.manage_any")) return true;
  return user.permissions.has("grading.own") && course.instructorId === user.id;
}

export type QueueFilter = { courseId?: string; status?: "pending" | "returned" | "graded" | "all"; kind?: "assignment" | "quiz" };

const PENDING: SubmissionStatus[] = ["SUBMITTED", "GRADING"];

export async function gradingQueue(user: SessionUser, filter: QueueFilter = {}) {
  const scope = gradingCourseScope(user);
  const course: Prisma.CourseWhereInput = { ...scope, ...(filter.courseId ? { id: filter.courseId } : {}) };
  const status = filter.status ?? "pending";
  const subStatus: SubmissionStatus[] =
    status === "pending" ? PENDING : status === "returned" ? ["RETURNED"] : status === "graded" ? ["APPROVED", "REJECTED"] : ["SUBMITTED", "GRADING", "RETURNED", "APPROVED", "REJECTED"];

  const [submissions, attempts] = await Promise.all([
    filter.kind === "quiz"
      ? Promise.resolve([])
      : db.assignmentSubmission.findMany({
          where: { status: { in: subStatus }, assignment: { course } },
          orderBy: status === "pending" ? { submittedAt: "asc" } : { updatedAt: "desc" },
          take: 200,
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, email: true } },
            assignment: { select: { id: true, title: true, dueAt: true, lessonId: true, course: { select: { id: true, title: true } } } },
          },
        }),
    filter.kind === "assignment" || status === "returned"
      ? Promise.resolve([])
      : db.quizAttempt.findMany({
          where: {
            quiz: { course },
            status: status === "pending" ? "PENDING_REVIEW" : status === "graded" ? "GRADED" : { in: ["PENDING_REVIEW", "GRADED"] },
            // No histórico, só tentativas que tinham questões abertas (as demais são automáticas).
            ...(status === "pending" ? {} : { answers: { some: { question: { type: "ESSAY" } } } }),
          },
          orderBy: status === "pending" ? { submittedAt: "asc" } : { gradedAt: "desc" },
          take: 200,
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, email: true } },
            quiz: { select: { id: true, title: true, lessonId: true, course: { select: { id: true, title: true } } } },
          },
        }),
  ]);

  type Item = {
    kind: "assignment" | "quiz";
    id: string;
    href: string;
    title: string;
    course: { id: string; title: string };
    student: { id: string; name: string; avatarUrl: string | null; email: string };
    submittedAt: Date | null;
    status: string;
    statusLabel: string;
    statusTone: (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS]["tone"];
    score: number | null;
    dueAt: Date | null;
    late: boolean;
  };
  const items: Item[] = [
    ...submissions.map((s) => ({
      kind: "assignment" as const,
      id: s.id,
      href: `/teacher/grading/submission/${s.id}`,
      title: s.assignment.title,
      course: s.assignment.course,
      student: s.user,
      submittedAt: s.submittedAt,
      status: s.status,
      statusLabel: SUBMISSION_STATUS[s.status].label,
      statusTone: SUBMISSION_STATUS[s.status].tone,
      score: s.score,
      dueAt: s.assignment.dueAt,
      late: !!s.assignment.dueAt && s.submittedAt > s.assignment.dueAt,
    })),
    ...attempts.map((a) => ({
      kind: "quiz" as const,
      id: a.id,
      href: `/teacher/grading/attempt/${a.id}`,
      title: `${a.quiz.title} · tentativa ${a.attemptNumber}`,
      course: a.quiz.course,
      student: a.user,
      submittedAt: a.submittedAt,
      status: a.status,
      statusLabel: a.status === "PENDING_REVIEW" ? "Aguardando correção" : a.passed ? "Aprovado" : "Reprovado",
      statusTone: (a.status === "PENDING_REVIEW" ? "info" : a.passed ? "success" : "danger") as Item["statusTone"],
      score: a.score,
      dueAt: null,
      late: false,
    })),
  ];
  items.sort((x, y) => {
    const a = x.submittedAt?.getTime() ?? 0;
    const b = y.submittedAt?.getTime() ?? 0;
    return status === "pending" ? a - b : b - a;
  });
  return items;
}

export async function gradingCounts(user: SessionUser) {
  const course = gradingCourseScope(user);
  const [pendingSubs, returned, graded, pendingAttempts] = await Promise.all([
    db.assignmentSubmission.count({ where: { status: { in: PENDING }, assignment: { course } } }),
    db.assignmentSubmission.count({ where: { status: "RETURNED", assignment: { course } } }),
    db.assignmentSubmission.count({ where: { status: { in: ["APPROVED", "REJECTED"] }, assignment: { course } } }),
    db.quizAttempt.count({ where: { status: "PENDING_REVIEW", quiz: { course } } }),
  ]);
  return { pending: pendingSubs + pendingAttempts, returned, graded };
}

// ── Atividades ───────────────────────────────────────────────────────

export async function getSubmissionForGrading(user: SessionUser, submissionId: string) {
  const s = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
      gradedBy: { select: { name: true } },
      assignment: { include: { course: { select: { id: true, title: true, instructorId: true } }, lesson: { select: { id: true, title: true } } } },
    },
  });
  if (!s) throw new NotFoundError("Entrega não encontrada.");
  if (!canGrade(user, s.assignment.course)) throw new ForbiddenError("Você não pode corrigir esta entrega.");
  const history = await db.assignmentSubmission.count({ where: { userId: s.userId, assignment: { courseId: s.assignment.courseId } } });
  return { ...s, history };
}

export async function gradeSubmission(user: SessionUser, input: unknown) {
  const data = parseInput(gradeSubmissionSchema, input);
  const s = await getSubmissionForGrading(user, data.submissionId);
  const a = s.assignment;
  if (data.status !== "RETURNED") {
    if (data.score == null) throw new ValidationError(undefined, { score: "Informe a nota." });
    if (data.score > a.maxScore) throw new ValidationError(undefined, { score: `A nota máxima é ${a.maxScore}.` });
  }
  if (data.status === "RETURNED" && !data.feedback) {
    throw new ValidationError(undefined, { feedback: "Explique ao aluno o que precisa ser ajustado." });
  }
  if (data.status === "APPROVED" && data.score! < a.passingScore) {
    throw new ValidationError(undefined, { score: `Para aprovar, a nota deve ser ao menos ${a.passingScore}.` });
  }

  await db.assignmentSubmission.update({
    where: { id: s.id },
    data: { status: data.status, score: data.score ?? null, feedback: data.feedback ?? null, gradedById: user.id, gradedAt: new Date() },
  });

  const label = SUBMISSION_STATUS[data.status].label;
  const link = a.lessonId ? `/learn/${a.courseId}/${a.lessonId}` : "/assignments";
  await notify(s.userId, {
    type: "ASSIGNMENT_GRADED",
    title: data.status === "RETURNED" ? `Atividade devolvida para ajustes: ${a.title}` : `Atividade corrigida: ${a.title}`,
    body: data.status === "RETURNED" ? "Veja os comentários do professor e envie novamente." : `Resultado: ${label}${data.score != null ? ` · nota ${data.score}/${a.maxScore}` : ""}.`,
    link,
  });
  await emailStudent(s.user, a.title, label, link);
  await audit("assignment.graded", {
    actorId: user.id,
    entityType: "submission",
    entityId: s.id,
    metadata: { status: data.status, score: data.score ?? null, assignmentId: a.id, studentId: s.userId },
  });

  if (data.status === "APPROVED") {
    if (a.lessonId) await completeLesson(s.userId, a.lessonId);
    await awardXp(s.userId, "assignment_approved", a.id);
  }
}

async function emailStudent(student: { name: string; email: string }, assignment: string, status: string, url: string) {
  try {
    const comm = await getSettings("communication");
    if (!comm.emailNotifications) return;
    await sendEmail(student.email, "assignment-graded", { name: student.name.split(" ")[0], assignment, status, url });
  } catch (error) {
    logger.error("grading.email_failed", { error, category: "infra" });
  }
}

// ── Questionários (questões abertas) ─────────────────────────────────

export async function getAttemptForGrading(user: SessionUser, attemptId: string) {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      quiz: { include: { course: { select: { id: true, title: true, instructorId: true } }, lesson: { select: { id: true, title: true } } } },
      answers: { include: { question: { include: { options: { orderBy: { position: "asc" } } } } } },
    },
  });
  if (!attempt) throw new NotFoundError("Tentativa não encontrada.");
  if (!canGrade(user, attempt.quiz.course)) throw new ForbiddenError("Você não pode corrigir esta avaliação.");
  // Questões na ordem em que o aluno as viu.
  const order = attempt.questionOrder.length ? attempt.questionOrder : attempt.answers.map((a) => a.questionId);
  const answers = [...attempt.answers].sort((a, b) => order.indexOf(a.questionId) - order.indexOf(b.questionId) || a.question.position - b.question.position);
  return { ...attempt, answers };
}

export async function gradeAttempt(user: SessionUser, input: unknown) {
  const data = parseInput(gradeAttemptSchema, input);
  const attempt = await getAttemptForGrading(user, data.attemptId);
  if (attempt.status === "IN_PROGRESS") throw new AppError("O aluno ainda não enviou esta tentativa.");

  const byId = new Map(attempt.answers.map((a) => [a.id, a]));
  for (const g of data.answers) {
    const ans = byId.get(g.answerId);
    if (!ans) throw new ValidationError("Resposta inválida.");
    if (ans.question.type !== "ESSAY" && ans.question.type !== "SHORT_ANSWER") throw new ValidationError("Apenas questões abertas ou de resposta curta podem ser corrigidas manualmente.");
    if (g.pointsAwarded > ans.question.points) throw new ValidationError(undefined, { [`answers.${g.answerId}`]: `Máximo de ${ans.question.points} ponto(s).` });
  }
  const missing = attempt.answers.filter((a) => a.question.type === "ESSAY" && a.pointsAwarded == null && !data.answers.some((g) => g.answerId === a.id));
  if (missing.length) throw new ValidationError("Atribua pontos a todas as respostas abertas.");

  await db.$transaction(
    data.answers.map((g) =>
      db.attemptAnswer.update({
        where: { id: g.answerId },
        data: { pointsAwarded: g.pointsAwarded, feedback: g.feedback ?? null, isCorrect: g.pointsAwarded >= (byId.get(g.answerId)!.question.points || 0) && g.pointsAwarded > 0 },
      }),
    ),
  );

  // Recalcula a pontuação da tentativa a partir das respostas.
  const answers = await db.attemptAnswer.findMany({ where: { attemptId: attempt.id }, include: { question: { select: { points: true } } } });
  const questionIds = attempt.questionOrder.length ? attempt.questionOrder : answers.map((a) => a.questionId);
  const questions = await db.question.findMany({ where: { id: { in: questionIds } }, select: { points: true } });
  const pointsTotal = questions.reduce((n, q) => n + q.points, 0) || answers.reduce((n, a) => n + a.question.points, 0);
  const pointsEarned = answers.reduce((n, a) => n + (a.pointsAwarded ?? 0), 0);
  const score = pointsTotal ? Math.round((pointsEarned / pointsTotal) * 1000) / 10 : 0;
  const passed = score >= attempt.quiz.passingScore;

  await db.quizAttempt.update({
    where: { id: attempt.id },
    data: { status: "GRADED", pointsEarned, pointsTotal, score, passed, gradedAt: new Date() },
  });

  const link = attempt.quiz.lessonId ? `/learn/${attempt.quiz.courseId}/${attempt.quiz.lessonId}` : "/my-courses";
  await notify(attempt.userId, {
    type: "QUIZ_GRADED",
    title: `Avaliação corrigida: ${attempt.quiz.title}`,
    body: `Sua nota: ${score.toLocaleString("pt-BR")}% · ${passed ? "aprovado" : "abaixo da nota mínima"}.`,
    link,
  });
  await emailStudent(attempt.user, attempt.quiz.title, passed ? `Aprovado (${score.toLocaleString("pt-BR")}%)` : `Reprovado (${score.toLocaleString("pt-BR")}%)`, link);
  await audit("quiz.graded", {
    actorId: user.id,
    entityType: "quiz_attempt",
    entityId: attempt.id,
    metadata: { score, passed, quizId: attempt.quizId, studentId: attempt.userId },
  });

  if (passed) {
    await awardXp(attempt.userId, "quiz_passed", attempt.quizId);
    if (attempt.quiz.requiredToComplete && attempt.quiz.lessonId) await completeLesson(attempt.userId, attempt.quiz.lessonId);
  }
  return { score, passed };
}
