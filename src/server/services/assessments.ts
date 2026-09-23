import "server-only";
import { db } from "@/server/db";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { lessonAccess } from "./access";
import { completeLesson } from "./learning";
import { awardXp } from "./gamification";
import { notify } from "./notifications";
import type { Question, QuestionOption } from "@prisma/client";

// ── Questionários ─────────────────────────────────────────────────

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function assertQuizAccess(user: SessionUser, quizId: string) {
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } } });
  if (!quiz) throw new NotFoundError("Avaliação não encontrada.");
  if (quiz.lessonId) {
    const access = await lessonAccess(user, quiz.lessonId);
    if (!access.allowed) throw new ForbiddenError("Matricule-se no curso para fazer esta avaliação.");
  }
  return quiz;
}

/** Estado do questionário para o aluno — nunca expõe gabarito de tentativa em andamento. */
export async function quizStateFor(user: SessionUser, quizId: string) {
  const quiz = await assertQuizAccess(user, quizId);
  const attempts = await db.quizAttempt.findMany({ where: { quizId, userId: user.id }, orderBy: { attemptNumber: "desc" }, include: { answers: true } });
  const current = attempts.find((a) => a.status === "IN_PROGRESS" && (!a.expiresAt || a.expiresAt > new Date()));
  const finished = attempts.filter((a) => a.status !== "IN_PROGRESS");
  const best = finished.reduce<(typeof finished)[number] | null>((b, a) => (a.score != null && (b?.score == null || a.score > b.score) ? a : b), null);
  const passed = finished.some((a) => a.passed);
  const remaining = quiz.maxAttempts === 0 ? Infinity : quiz.maxAttempts - finished.length - (current ? 1 : 0);

  const sanitize = (q: Question & { options: QuestionOption[] }) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  });

  const ordered = current ? current.questionOrder.map((id) => quiz.questions.find((q) => q.id === id)).filter(Boolean) : quiz.questions;

  // Resultado detalhado da última tentativa finalizada, respeitando o modo de feedback.
  const last = finished[0];
  const showFeedback = !!last && (quiz.feedbackMode === "AFTER_SUBMIT" || (quiz.feedbackMode === "AFTER_PASS" && passed));
  const review = last && showFeedback
    ? quiz.questions.map((q) => {
        const ans = last.answers.find((a) => a.questionId === q.id);
        return {
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          explanation: q.explanation,
          points: q.points,
          options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, selected: ans?.selectedOptionIds.includes(o.id) ?? false })),
          textAnswer: ans?.textAnswer ?? null,
          acceptedAnswers: q.type === "SHORT_ANSWER" ? q.acceptedAnswers : [],
          isCorrect: ans?.isCorrect ?? null,
          pointsAwarded: ans?.pointsAwarded ?? null,
          feedback: ans?.feedback ?? null,
        };
      })
    : null;

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      maxAttempts: quiz.maxAttempts,
      timeLimitMinutes: quiz.timeLimitMinutes,
      questionCount: quiz.questions.length,
      totalPoints: quiz.questions.reduce((s, q) => s + q.points, 0),
      feedbackMode: quiz.feedbackMode,
    },
    current: current
      ? {
          id: current.id,
          attemptNumber: current.attemptNumber,
          expiresAt: current.expiresAt?.toISOString() ?? null,
          questions: ordered.map((q) => sanitize(q!)),
          saved: Object.fromEntries(current.answers.map((a) => [a.questionId, { selected: a.selectedOptionIds, text: a.textAnswer ?? "" }])),
        }
      : null,
    attempts: finished.map((a) => ({ id: a.id, attemptNumber: a.attemptNumber, status: a.status, score: a.score, passed: a.passed, submittedAt: a.submittedAt?.toISOString() ?? null })),
    bestScore: best?.score ?? null,
    passed,
    remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : null,
    review,
  };
}

export async function startAttempt(user: SessionUser, quizId: string) {
  const quiz = await assertQuizAccess(user, quizId);
  if (!quiz.questions.length) throw new AppError("Esta avaliação ainda não tem questões.", "EMPTY_QUIZ");
  const attempts = await db.quizAttempt.findMany({ where: { quizId, userId: user.id } });
  const open = attempts.find((a) => a.status === "IN_PROGRESS");
  if (open && (!open.expiresAt || open.expiresAt > new Date())) return open;
  if (open) await finalizeAttempt(open.id, {}); // tempo esgotado: finaliza com o que foi salvo
  if (attempts.some((a) => a.status === "PENDING_REVIEW")) {
    throw new AppError("Aguarde a correção da tentativa anterior antes de refazer.", "AWAITING_REVIEW");
  }
  const used = await db.quizAttempt.count({ where: { quizId, userId: user.id, status: { not: "IN_PROGRESS" } } });
  if (quiz.maxAttempts > 0 && used >= quiz.maxAttempts) throw new AppError("Você já usou todas as tentativas desta avaliação.", "NO_ATTEMPTS", 403);

  const order = (quiz.shuffleQuestions ? shuffle(quiz.questions) : quiz.questions).map((q) => q.id);
  return db.quizAttempt.create({
    data: {
      quizId,
      userId: user.id,
      attemptNumber: attempts.length + 1,
      questionOrder: order,
      expiresAt: quiz.timeLimitMinutes ? new Date(Date.now() + quiz.timeLimitMinutes * 60_000) : null,
    },
  });
}

export type AnswerInput = Record<string, { selected?: string[]; text?: string }>;

/** Salvamento parcial (autosave) — permite retomar a tentativa. */
export async function saveAnswers(user: SessionUser, attemptId: string, answers: AnswerInput) {
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.id) throw new NotFoundError();
  if (attempt.status !== "IN_PROGRESS") throw new AppError("Esta tentativa já foi enviada.", "ATTEMPT_CLOSED");
  const valid = new Set(attempt.questionOrder);
  await db.$transaction(
    Object.entries(answers)
      .filter(([qid]) => valid.has(qid))
      .map(([questionId, a]) =>
        db.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          create: { attemptId, questionId, selectedOptionIds: a.selected ?? [], textAnswer: a.text?.slice(0, 5000) ?? null },
          update: { selectedOptionIds: a.selected ?? [], textAnswer: a.text?.slice(0, 5000) ?? null },
        }),
      ),
  );
}

export async function submitAttempt(user: SessionUser, attemptId: string, answers: AnswerInput) {
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.id) throw new NotFoundError();
  if (attempt.status !== "IN_PROGRESS") throw new AppError("Esta tentativa já foi enviada.", "ATTEMPT_CLOSED");
  // Tolerância de 30s para latência de rede após o fim do tempo.
  const late = attempt.expiresAt && Date.now() > attempt.expiresAt.getTime() + 30_000;
  return finalizeAttempt(attemptId, late ? {} : answers);
}

/** Corrige automaticamente objetivas; questões abertas deixam a tentativa em PENDING_REVIEW. */
async function finalizeAttempt(attemptId: string, answers: AnswerInput) {
  const attempt = await db.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { quiz: { include: { questions: { include: { options: true } } } }, answers: true },
  });
  const saved = new Map(attempt.answers.map((a) => [a.questionId, a]));
  let earned = 0;
  let total = 0;
  let pendingReview = false;

  const rows = attempt.quiz.questions
    .filter((q) => attempt.questionOrder.includes(q.id))
    .map((q) => {
      total += q.points;
      const given = answers[q.id] ?? { selected: saved.get(q.id)?.selectedOptionIds, text: saved.get(q.id)?.textAnswer ?? undefined };
      const selected = (given.selected ?? []).filter((id) => q.options.some((o) => o.id === id));
      const text = given.text?.slice(0, 5000) ?? null;
      let isCorrect: boolean | null = null;
      let points: number | null = 0;
      if (q.type === "ESSAY") {
        pendingReview = true;
        points = null;
      } else if (q.type === "SHORT_ANSWER") {
        isCorrect = !!text && q.acceptedAnswers.some((acc) => normalize(acc) === normalize(text));
      } else {
        const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
        isCorrect = selected.length === correct.length && [...selected].sort().every((id, i) => id === correct[i]);
      }
      if (isCorrect) points = q.points;
      if (points) earned += points;
      return { questionId: q.id, selectedOptionIds: selected, textAnswer: text, isCorrect, pointsAwarded: points };
    });

  await db.$transaction([
    db.attemptAnswer.deleteMany({ where: { attemptId } }),
    db.attemptAnswer.createMany({ data: rows.map((r) => ({ ...r, attemptId })) }),
  ]);

  const score = total ? Math.round((earned / total) * 1000) / 10 : 0;
  const passed = pendingReview ? null : score >= attempt.quiz.passingScore;
  const updated = await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      status: pendingReview ? "PENDING_REVIEW" : "GRADED",
      submittedAt: new Date(),
      gradedAt: pendingReview ? null : new Date(),
      score: pendingReview ? null : score,
      pointsEarned: earned,
      pointsTotal: total,
      passed,
    },
  });

  if (pendingReview) {
    const course = await db.course.findUnique({ where: { id: attempt.quiz.courseId }, select: { instructorId: true } });
    if (course) await notify(course.instructorId, { type: "QUIZ_GRADED", title: "Nova avaliação para corrigir", body: attempt.quiz.title, link: "/teacher/grading" });
  } else if (passed) {
    await awardXp(attempt.userId, "quiz_passed", attempt.quizId);
    if (attempt.quiz.lessonId) await completeLesson(attempt.userId, attempt.quiz.lessonId);
  } else if (attempt.quiz.lessonId && !attempt.quiz.requiredToComplete) {
    await completeLesson(attempt.userId, attempt.quiz.lessonId);
  }
  await audit("quiz.submitted", { actorId: attempt.userId, entityType: "quiz_attempt", entityId: attemptId, metadata: { score, pendingReview } });
  return updated;
}

// ── Atividades ────────────────────────────────────────────────────

export async function assignmentStateFor(user: SessionUser, assignmentId: string) {
  const assignment = await db.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new NotFoundError();
  if (assignment.lessonId) {
    const access = await lessonAccess(user, assignment.lessonId);
    if (!access.allowed) throw new ForbiddenError();
  }
  const submission = await db.assignmentSubmission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId: user.id } },
    include: { file: { select: { id: true, originalName: true, sizeBytes: true, mimeType: true } }, gradedBy: { select: { name: true } } },
  });
  return { assignment, submission };
}

export async function submitAssignment(user: SessionUser, input: { assignmentId: string; text?: string; fileId?: string | null }) {
  const { assignment, submission } = await assignmentStateFor(user, input.assignmentId);
  const text = input.text?.trim() || null;
  if (!text && !input.fileId) throw new ValidationError("Escreva sua resposta ou anexe um arquivo.");
  if (text && !assignment.allowText) throw new ValidationError("Esta atividade aceita apenas arquivo.");
  if (input.fileId && !assignment.allowFile) throw new ValidationError("Esta atividade aceita apenas texto.");
  if (input.fileId) {
    const file = await db.fileAsset.findUnique({ where: { id: input.fileId } });
    if (!file || file.ownerId !== user.id) throw new ForbiddenError("Arquivo inválido.");
  }
  if (submission && ["GRADING", "APPROVED", "REJECTED"].includes(submission.status)) {
    throw new AppError("Esta atividade já está em correção ou foi corrigida.", "LOCKED");
  }

  const saved = await db.assignmentSubmission.upsert({
    where: { assignmentId_userId: { assignmentId: assignment.id, userId: user.id } },
    create: { assignmentId: assignment.id, userId: user.id, textAnswer: text, fileId: input.fileId ?? null },
    update: { textAnswer: text, fileId: input.fileId ?? null, status: "SUBMITTED", submittedAt: new Date() },
  });
  const course = await db.course.findUnique({ where: { id: assignment.courseId }, select: { instructorId: true } });
  if (course) {
    await notify(course.instructorId, { type: "NEW_ASSIGNMENT", title: `Nova entrega: ${assignment.title}`, body: user.name, link: "/teacher/grading" });
  }
  await audit("assignment.submitted", { actorId: user.id, entityType: "assignment_submission", entityId: saved.id });
  return saved;
}

/** Lista de atividades do aluno (todas as atividades dos cursos em que está matriculado). */
export async function studentAssignments(userId: string) {
  const enrollments = await db.enrollment.findMany({ where: { userId, status: { not: "CANCELLED" } }, select: { courseId: true } });
  const assignments = await db.assignment.findMany({
    where: { courseId: { in: enrollments.map((e) => e.courseId) }, lesson: { isPublished: true } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
    include: {
      course: { select: { id: true, title: true, slug: true } },
      lesson: { select: { id: true } },
      submissions: { where: { userId }, select: { status: true, score: true, submittedAt: true, gradedAt: true } },
    },
  });
  return assignments.map((a) => ({ ...a, submission: a.submissions[0] ?? null }));
}
