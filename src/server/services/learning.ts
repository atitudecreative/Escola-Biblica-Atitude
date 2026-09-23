import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { getSettings } from "@/server/settings";
import { AppError, NotFoundError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/session";
import { notify } from "./notifications";
import { awardXp } from "./gamification";
import { issueCertificate } from "./certificates";
import { emitWebhook } from "./webhooks";

// ── Matrícula ─────────────────────────────────────────────────────

export async function enroll(user: SessionUser, courseId: string) {
  const [course, settings] = await Promise.all([db.course.findUnique({ where: { id: courseId } }), getSettings("courses")]);
  if (!course || course.status !== "PUBLISHED") throw new NotFoundError("Este curso não está disponível para matrícula.");
  if (!settings.allowSelfEnrollment) throw new AppError("As matrículas são feitas pela secretaria. Fale com a Escola.", "SELF_ENROLL_DISABLED", 403);
  if (course.priceCents > 0) {
    // Monetização preparada, sem gateway ativo: não simulamos pagamento.
    throw new AppError("Este curso é pago e a inscrição online ainda não está disponível. Fale com a secretaria.", "PAYMENT_UNAVAILABLE", 402);
  }
  return createEnrollment(user.id, courseId, "SELF", user.id);
}

export async function createEnrollment(userId: string, courseId: string, source: "SELF" | "ADMIN", actorId: string) {
  const existing = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing && existing.status !== "CANCELLED") return existing;
  const enrollment = existing
    ? await db.enrollment.update({ where: { id: existing.id }, data: { status: "ACTIVE", source, enrolledAt: new Date() } })
    : await db.enrollment.create({ data: { userId, courseId, source } });
  await db.course.update({ where: { id: courseId }, data: { enrollmentCount: { increment: 1 } } });
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true, slug: true } });
  await notify(userId, { type: "COURSE", title: `Matrícula confirmada em ${course.title}`, body: "Bons estudos! Sua primeira aula já está liberada.", link: `/courses/${course.slug}` });
  await audit("enrollment.created", { actorId, entityType: "enrollment", entityId: enrollment.id, metadata: { userId, courseId, source } });
  emitWebhook("enrollment.created", { enrollmentId: enrollment.id, userId, courseId });
  return enrollment;
}

export async function cancelEnrollment(enrollmentId: string, actorId: string) {
  const e = await db.enrollment.update({ where: { id: enrollmentId }, data: { status: "CANCELLED" } });
  await db.course.update({ where: { id: e.courseId }, data: { enrollmentCount: { decrement: 1 } } });
  await audit("enrollment.cancelled", { actorId, entityType: "enrollment", entityId: e.id });
  return e;
}

// ── Estrutura e bloqueio sequencial ───────────────────────────────

/** Aulas publicadas do curso em ordem (módulo → aula). */
export async function orderedLessons(courseId: string) {
  const modules = await db.module.findMany({
    where: { courseId },
    orderBy: { position: "asc" },
    include: { lessons: { where: { isPublished: true }, orderBy: { position: "asc" }, select: { id: true, title: true, type: true, durationSeconds: true, isPreview: true, moduleId: true } } },
  });
  return modules.flatMap((m) => m.lessons);
}

/** Com curso sequencial, uma aula só libera quando a anterior foi concluída. */
export async function lockedLessonIds(courseId: string, userId: string, sequential: boolean) {
  if (!sequential) return new Set<string>();
  const [lessons, done] = await Promise.all([
    orderedLessons(courseId),
    db.lessonProgress.findMany({ where: { userId, courseId, status: "COMPLETED" }, select: { lessonId: true } }),
  ]);
  const completed = new Set(done.map((d) => d.lessonId));
  const locked = new Set<string>();
  let previousDone = true;
  for (const l of lessons) {
    if (!previousDone) locked.add(l.id);
    previousDone = previousDone && completed.has(l.id);
  }
  return locked;
}

// ── Progresso ─────────────────────────────────────────────────────

function utcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Registra progresso de reprodução (chamado periodicamente pelo player).
 * `deltaSeconds` é limitado para impedir inflar o tempo assistido.
 */
export async function recordProgress(userId: string, lessonId: string, positionSeconds: number, deltaSeconds: number) {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { courseId: true, durationSeconds: true } });
  const delta = Math.max(0, Math.min(deltaSeconds, 45));
  const position = Math.max(0, Math.min(positionSeconds, lesson.durationSeconds || positionSeconds));

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, courseId: lesson.courseId, positionSeconds: position, watchedSeconds: delta },
    update: { positionSeconds: position, watchedSeconds: { increment: delta } },
  });
  await touchStudy(userId, lesson.courseId, lessonId, delta);
}

async function touchStudy(userId: string, courseId: string, lessonId: string, seconds: number, lessons = 0) {
  const date = utcDay();
  await Promise.all([
    db.userActivityDay.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, seconds, lessons },
      update: { seconds: { increment: seconds }, lessons: { increment: lessons } },
    }),
    db.enrollment.updateMany({ where: { userId, courseId }, data: { lastLessonId: lessonId, lastAccessedAt: new Date() } }),
  ]);
}

/** Abrir uma aula conta como "continuar de onde parei". */
export async function markLessonOpened(userId: string, courseId: string, lessonId: string) {
  await db.enrollment.updateMany({ where: { userId, courseId }, data: { lastLessonId: lessonId, lastAccessedAt: new Date() } });
}

export async function completeLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { courseId: true, title: true } });
  const prev = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  if (prev?.status === "COMPLETED") return { alreadyCompleted: true, courseCompleted: false };

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, courseId: lesson.courseId, status: "COMPLETED", completedAt: new Date() },
    update: { status: "COMPLETED", completedAt: new Date() },
  });
  await touchStudy(userId, lesson.courseId, lessonId, 0, 1);
  await awardXp(userId, "lesson_completed", lessonId);
  emitWebhook("lesson.completed", { userId, lessonId, courseId: lesson.courseId });
  const courseCompleted = await recomputeEnrollment(userId, lesson.courseId);
  return { alreadyCompleted: false, courseCompleted };
}

/** Recalcula % do curso; conclui a matrícula e emite certificado ao chegar em 100%. */
export async function recomputeEnrollment(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!enrollment || enrollment.status === "CANCELLED") return false;
  const [total, done] = await Promise.all([
    db.lesson.count({ where: { courseId, isPublished: true } }),
    db.lessonProgress.count({ where: { userId, courseId, status: "COMPLETED", lesson: { isPublished: true } } }),
  ]);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const completes = percent >= 100 && enrollment.status !== "COMPLETED";
  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { progressPercent: percent, ...(completes ? { status: "COMPLETED", completedAt: new Date() } : {}) },
  });
  if (completes) {
    const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true } });
    await awardXp(userId, "course_completed", courseId);
    await audit("course.completed", { actorId: userId, entityType: "course", entityId: courseId });
    emitWebhook("course.completed", { userId, courseId });
    const settings = await getSettings("courses");
    if (settings.autoIssueCertificates) await issueCertificate(enrollment.id);
    else await notify(userId, { type: "COURSE", title: `Você concluiu ${course.title}!`, body: "Seu certificado será liberado pela secretaria.", link: "/certificates" });
  }
  return completes;
}

// ── Consultas para o aluno ────────────────────────────────────────

export async function continueLearning(userId: string, take = 3) {
  return db.enrollment.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ lastAccessedAt: { sort: "desc", nulls: "last" } }, { enrolledAt: "desc" }],
    take,
    include: {
      course: { select: { id: true, slug: true, title: true, coverUrl: true, category: { select: { name: true, position: true } }, instructor: { select: { name: true } } } },
      lastLesson: { select: { id: true, title: true, module: { select: { title: true } } } },
    },
  });
}

/** Próxima aula a assistir: a última aberta se não concluída, senão a primeira pendente. */
export async function nextLessonFor(userId: string, courseId: string) {
  const [lessons, done, enrollment] = await Promise.all([
    orderedLessons(courseId),
    db.lessonProgress.findMany({ where: { userId, courseId, status: "COMPLETED" }, select: { lessonId: true } }),
    db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { lastLessonId: true } }),
  ]);
  const completed = new Set(done.map((d) => d.lessonId));
  if (enrollment?.lastLessonId && !completed.has(enrollment.lastLessonId) && lessons.some((l) => l.id === enrollment.lastLessonId)) {
    return enrollment.lastLessonId;
  }
  return (lessons.find((l) => !completed.has(l.id)) ?? lessons[0])?.id ?? null;
}

export async function studentStats(userId: string) {
  const [active, completed, watched, avg, certificates, activity] = await Promise.all([
    db.enrollment.count({ where: { userId, status: "ACTIVE" } }),
    db.enrollment.count({ where: { userId, status: "COMPLETED" } }),
    db.userActivityDay.aggregate({ where: { userId }, _sum: { seconds: true } }),
    db.enrollment.aggregate({ where: { userId, status: { not: "CANCELLED" } }, _avg: { progressPercent: true } }),
    db.certificate.count({ where: { userId, revokedAt: null } }),
    db.userActivityDay.findMany({
      where: { userId, date: { gte: new Date(Date.now() - 27 * 86_400_000) } },
      orderBy: { date: "asc" },
    }),
  ]);
  return {
    active,
    completed,
    hours: (watched._sum.seconds ?? 0) / 3600,
    avgProgress: Math.round(avg._avg.progressPercent ?? 0),
    certificates,
    activity,
  };
}
