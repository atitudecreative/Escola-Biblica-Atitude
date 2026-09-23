import "server-only";
import type { LessonType, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { parseInput } from "@/server/action";
import { getSettings } from "@/server/settings";
import type { SessionUser } from "@/server/auth/session";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { slugify } from "@/lib/utils";
import {
  assignmentSchema,
  courseDetailsSchema,
  courseSettingsSchema,
  lessonSchema,
  materialSchema,
  moduleSchema,
  newCourseSchema,
  newLessonSchema,
  questionSchema,
  quizSettingsSchema,
  renameModuleSchema,
  reorderSchema,
} from "@/lib/validation/teacher";
import { assertCourseManager, canManageCourse } from "./access";
import { notify } from "./notifications";
import { emitWebhook } from "./webhooks";
import { recomputeEnrollment } from "./learning";

/**
 * Course builder: criação e edição de cursos, currículo (módulos/aulas),
 * avaliações e publicação. Toda função pública valida a entrada (Zod) e
 * verifica se o usuário gerencia o curso antes de tocar no banco.
 */

// ── Escopo e autorização ─────────────────────────────────────────────

/** Cursos que o usuário gerencia (todos, para quem tem courses.manage_any). */
export function managedCourseScope(user: SessionUser): Prisma.CourseWhereInput {
  if (user.permissions.has("courses.manage_any")) return {};
  if (user.permissions.has("courses.manage_own") || user.permissions.has("courses.create")) return { instructorId: user.id };
  return { id: "__none__" };
}

async function assertModuleManager(user: SessionUser, moduleId: string) {
  const mod = await db.module.findUnique({ where: { id: moduleId }, include: { course: true } });
  if (!mod) throw new NotFoundError("Módulo não encontrado.");
  if (!canManageCourse(user, mod.course)) throw new ForbiddenError("Você não pode editar este curso.");
  return mod;
}

async function assertLessonManager(user: SessionUser, lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { course: true } });
  if (!lesson) throw new NotFoundError("Aula não encontrada.");
  if (!canManageCourse(user, lesson.course)) throw new ForbiddenError("Você não pode editar este curso.");
  return lesson;
}

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "curso";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const hit = await db.course.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${root}-${i}`.slice(0, 80);
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Mantém course.durationMinutes = soma das aulas publicadas. */
export async function syncCourseDuration(courseId: string) {
  const agg = await db.lesson.aggregate({ where: { courseId, isPublished: true }, _sum: { durationSeconds: true } });
  const minutes = Math.round((agg._sum.durationSeconds ?? 0) / 60);
  await db.course.update({ where: { id: courseId }, data: { durationMinutes: minutes } });
  return minutes;
}

/** Após mudar o conjunto de aulas publicadas, o % de cada matrícula muda. */
async function recomputeCourseProgress(courseId: string) {
  const enrollments = await db.enrollment.findMany({ where: { courseId, status: { not: "CANCELLED" } }, select: { userId: true } });
  for (const e of enrollments) await recomputeEnrollment(e.userId, courseId);
}

async function touchCourse(courseId: string) {
  await db.course.update({ where: { id: courseId }, data: { updatedAt: new Date() } });
}

// ── Curso ────────────────────────────────────────────────────────────

export async function createCourse(user: SessionUser, input: unknown) {
  if (!user.permissions.has("courses.create") && !user.permissions.has("courses.manage_any")) throw new ForbiddenError("Você não pode criar cursos.");
  const data = parseInput(newCourseSchema, input);
  if (data.categoryId) {
    const cat = await db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!cat) throw new ValidationError(undefined, { categoryId: "Categoria inválida." });
  }
  const template = await db.certificateTemplate.findFirst({ where: { isDefault: true }, select: { id: true } });
  const course = await db.course.create({
    data: {
      title: data.title,
      subtitle: data.subtitle ?? null,
      slug: await uniqueSlug(data.title),
      categoryId: data.categoryId || null,
      level: data.level,
      instructorId: user.id,
      certificateTemplateId: template?.id ?? null,
      modules: { create: { title: "Módulo 1", position: 0 } },
    },
  });
  await audit("course.created", { actorId: user.id, entityType: "course", entityId: course.id, metadata: { title: course.title } });
  return course;
}

export async function getBuilderCourse(user: SessionUser, courseId: string) {
  await assertCourseManager(user, courseId);
  return db.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      category: { select: { id: true, name: true } },
      instructor: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            select: {
              id: true, title: true, type: true, durationSeconds: true, isPreview: true, isPublished: true, position: true,
              videoUrl: true, mediaFileId: true, externalUrl: true, content: true,
              _count: { select: { materials: true } },
              quiz: { select: { id: true, _count: { select: { questions: true } } } },
              assignment: { select: { id: true } },
            },
          },
        },
      },
      _count: { select: { enrollments: true, lessons: true } },
    },
  });
}

export async function updateCourseDetails(user: SessionUser, input: unknown) {
  const data = parseInput(courseDetailsSchema, input);
  const course = await assertCourseManager(user, data.courseId);
  if (data.slug !== course.slug) {
    const taken = await db.course.findUnique({ where: { slug: data.slug }, select: { id: true } });
    if (taken && taken.id !== course.id) throw new ValidationError(undefined, { slug: "Este endereço já está em uso por outro curso." });
  }
  if (data.categoryId) {
    const cat = await db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!cat) throw new ValidationError(undefined, { categoryId: "Categoria inválida." });
  }
  // Tags: reaproveita existentes pelo slug e cria as novas.
  const tagIds: string[] = [];
  for (const name of [...new Set(data.tags.map((t) => t.trim()))]) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await db.tag.upsert({ where: { slug }, create: { name, slug }, update: {} });
    if (!tagIds.includes(tag.id)) tagIds.push(tag.id);
  }
  await db.$transaction([
    db.course.update({
      where: { id: course.id },
      data: {
        title: data.title,
        subtitle: data.subtitle ?? null,
        slug: data.slug,
        description: data.description,
        coverUrl: data.coverUrl ?? null,
        trailerUrl: data.trailerUrl ?? null,
        categoryId: data.categoryId || null,
        level: data.level,
        language: data.language,
        workloadHours: data.workloadHours,
        objectives: data.objectives,
        requirements: data.requirements,
        targetAudience: data.targetAudience,
        faq: data.faq,
      },
    }),
    db.courseTag.deleteMany({ where: { courseId: course.id } }),
    db.courseTag.createMany({ data: tagIds.map((tagId) => ({ courseId: course.id, tagId })) }),
  ]);
  await audit("course.updated", { actorId: user.id, entityType: "course", entityId: course.id, metadata: { section: "details" } });
  return { slug: data.slug };
}

export async function updateCourseSettings(user: SessionUser, input: unknown) {
  const data = parseInput(courseSettingsSchema, input);
  const course = await assertCourseManager(user, data.courseId);
  if (data.certificateTemplateId) {
    const t = await db.certificateTemplate.findUnique({ where: { id: data.certificateTemplateId }, select: { id: true } });
    if (!t) throw new ValidationError(undefined, { certificateTemplateId: "Modelo inválido." });
  }
  const canFeature = user.permissions.has("courses.manage_any");
  await db.course.update({
    where: { id: course.id },
    data: {
      sequential: data.sequential,
      certificateEnabled: data.certificateEnabled,
      certificateTemplateId: data.certificateTemplateId || null,
      priceCents: data.priceCents,
      ...(canFeature && data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
    },
  });
  await audit("course.updated", { actorId: user.id, entityType: "course", entityId: course.id, metadata: { section: "settings", priceCents: data.priceCents } });
}

// ── Publicação ───────────────────────────────────────────────────────

export async function publishChecklist(courseId: string) {
  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { description: true, coverUrl: true, categoryId: true, workloadHours: true, objectives: true, modules: { select: { lessons: { where: { isPublished: true }, select: { id: true } } } } },
  });
  const publishedLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  return [
    { key: "lessons", label: "Ao menos uma aula publicada", ok: course.modules.some((m) => m.lessons.length > 0), required: true, detail: `${publishedLessons} publicada(s)` },
    { key: "description", label: "Descrição do curso", ok: course.description.trim().length >= 40, required: false },
    { key: "category", label: "Categoria definida", ok: !!course.categoryId, required: false },
    { key: "cover", label: "Capa enviada", ok: !!course.coverUrl, required: false },
    { key: "objectives", label: "Objetivos de aprendizagem", ok: course.objectives.length > 0, required: false },
    { key: "workload", label: "Carga horária do certificado", ok: course.workloadHours > 0, required: false },
  ];
}

export async function canPublishDirectly(user: SessionUser) {
  const settings = await getSettings("courses");
  return !settings.requireReview || user.permissions.has("courses.publish");
}

async function reviewers() {
  return db.user.findMany({
    where: { status: "ACTIVE", roles: { some: { role: { permissions: { some: { permission: { key: "courses.publish" } } } } } } },
    select: { id: true },
  });
}

/**
 * "Publicar" ou "Enviar para revisão", conforme a configuração da escola e as
 * permissões do usuário. Retorna o novo status.
 */
export async function publishOrSubmit(user: SessionUser, courseId: string) {
  const course = await assertCourseManager(user, courseId);
  if (course.status === "PUBLISHED") throw new AppError("O curso já está publicado.");
  const checklist = await publishChecklist(courseId);
  const missing = checklist.filter((c) => c.required && !c.ok);
  if (missing.length) throw new AppError("Para publicar, o curso precisa de ao menos um módulo com uma aula publicada.", "NOT_READY", 422);

  if (!(await canPublishDirectly(user))) {
    if (course.status === "REVIEW") throw new AppError("O curso já está aguardando revisão.");
    await db.course.update({ where: { id: courseId }, data: { status: "REVIEW" } });
    await audit("course.submitted_for_review", { actorId: user.id, entityType: "course", entityId: courseId });
    const admins = (await reviewers()).map((r) => r.id).filter((id) => id !== user.id);
    await notify(admins, {
      type: "COURSE",
      title: `Curso enviado para revisão: ${course.title}`,
      body: `${user.name} enviou o curso para revisão antes da publicação.`,
      link: `/teacher/courses/${courseId}`,
    });
    return "REVIEW" as const;
  }

  await db.course.update({ where: { id: courseId }, data: { status: "PUBLISHED", publishedAt: course.publishedAt ?? new Date() } });
  await syncCourseDuration(courseId);
  await audit("course.published", { actorId: user.id, entityType: "course", entityId: courseId, metadata: { from: course.status } });
  emitWebhook("course.published", { courseId, slug: course.slug, title: course.title });
  if (course.instructorId !== user.id) {
    await notify(course.instructorId, { type: "COURSE", title: `Seu curso foi publicado: ${course.title}`, link: `/teacher/courses/${courseId}` });
  }
  return "PUBLISHED" as const;
}

/** Professor cancela o envio, ou revisor devolve o curso ao rascunho. */
export async function returnToDraft(user: SessionUser, courseId: string, reason?: string) {
  const course = await assertCourseManager(user, courseId);
  if (course.status !== "REVIEW") throw new AppError("Apenas cursos em revisão podem voltar para rascunho.");
  await db.course.update({ where: { id: courseId }, data: { status: "DRAFT" } });
  await audit("course.returned_to_draft", { actorId: user.id, entityType: "course", entityId: courseId, metadata: { reason: reason ?? null } });
  if (course.instructorId !== user.id) {
    await notify(course.instructorId, {
      type: "COURSE",
      title: `Revisão: ajustes solicitados em ${course.title}`,
      body: reason || "O curso voltou para rascunho. Revise e envie novamente.",
      link: `/teacher/courses/${courseId}`,
    });
  }
}

export async function archiveCourse(user: SessionUser, courseId: string) {
  const course = await assertCourseManager(user, courseId);
  if (course.status === "ARCHIVED") throw new AppError("O curso já está arquivado.");
  await db.course.update({ where: { id: courseId }, data: { status: "ARCHIVED" } });
  await audit("course.archived", { actorId: user.id, entityType: "course", entityId: courseId, metadata: { from: course.status } });
}

/** Restaura um curso arquivado: volta publicado se o usuário pode publicar direto; senão, rascunho. */
export async function restoreCourse(user: SessionUser, courseId: string) {
  const course = await assertCourseManager(user, courseId);
  if (course.status !== "ARCHIVED") throw new AppError("Apenas cursos arquivados podem ser restaurados.");
  const status = course.publishedAt && (await canPublishDirectly(user)) ? "PUBLISHED" : "DRAFT";
  await db.course.update({ where: { id: courseId }, data: { status } });
  await audit("course.restored", { actorId: user.id, entityType: "course", entityId: courseId, metadata: { to: status } });
  return status;
}

export async function deleteDraftCourse(user: SessionUser, courseId: string) {
  const course = await assertCourseManager(user, courseId);
  if (course.status !== "DRAFT") throw new AppError("Só é possível excluir cursos em rascunho. Arquive cursos já publicados.");
  const [enrollments, orders] = await Promise.all([
    db.enrollment.count({ where: { courseId } }),
    db.orderItem.count({ where: { courseId } }),
  ]);
  if (enrollments || orders) throw new AppError("Este curso já tem alunos vinculados. Arquive-o em vez de excluir.");
  await db.course.delete({ where: { id: courseId } });
  await audit("course.deleted", { actorId: user.id, entityType: "course", entityId: courseId, metadata: { title: course.title } });
}

// ── Módulos ──────────────────────────────────────────────────────────

export async function createModule(user: SessionUser, input: unknown) {
  const data = parseInput(moduleSchema, input);
  await assertCourseManager(user, data.courseId);
  const last = await db.module.aggregate({ where: { courseId: data.courseId }, _max: { position: true } });
  const mod = await db.module.create({
    data: { courseId: data.courseId, title: data.title, description: data.description ?? null, position: (last._max.position ?? -1) + 1 },
  });
  await touchCourse(data.courseId);
  return mod;
}

export async function renameModule(user: SessionUser, input: unknown) {
  const data = parseInput(renameModuleSchema, input);
  const mod = await assertModuleManager(user, data.moduleId);
  await db.module.update({ where: { id: mod.id }, data: { title: data.title, description: data.description ?? null } });
  await touchCourse(mod.courseId);
}

export async function deleteModule(user: SessionUser, moduleId: string) {
  const mod = await assertModuleManager(user, moduleId);
  const count = await db.module.count({ where: { courseId: mod.courseId } });
  if (count <= 1) throw new AppError("O curso precisa ter ao menos um módulo.");
  await db.module.delete({ where: { id: mod.id } });
  await normalizeModulePositions(mod.courseId);
  await syncCourseDuration(mod.courseId);
  if (mod.course.status === "PUBLISHED") await recomputeCourseProgress(mod.courseId);
  await audit("module.deleted", { actorId: user.id, entityType: "module", entityId: mod.id, metadata: { courseId: mod.courseId, title: mod.title } });
}

export async function duplicateModule(user: SessionUser, moduleId: string) {
  const mod = await assertModuleManager(user, moduleId);
  const lessons = await db.lesson.findMany({ where: { moduleId }, orderBy: { position: "asc" }, select: { id: true } });
  // Abre espaço logo após o original.
  await db.module.updateMany({ where: { courseId: mod.courseId, position: { gt: mod.position } }, data: { position: { increment: 1 } } });
  const copy = await db.module.create({
    data: { courseId: mod.courseId, title: `${mod.title} (cópia)`.slice(0, 120), description: mod.description, position: mod.position + 1 },
  });
  for (const [i, l] of lessons.entries()) await copyLesson(l.id, copy.id, i, mod.course.status === "PUBLISHED");
  await syncCourseDuration(mod.courseId);
  await audit("module.duplicated", { actorId: user.id, entityType: "module", entityId: copy.id, metadata: { from: mod.id } });
  return copy;
}

async function normalizeModulePositions(courseId: string) {
  const mods = await db.module.findMany({ where: { courseId }, orderBy: { position: "asc" }, select: { id: true } });
  await db.$transaction(mods.map((m, i) => db.module.update({ where: { id: m.id }, data: { position: i } })));
}

async function normalizeLessonPositions(moduleId: string) {
  const lessons = await db.lesson.findMany({ where: { moduleId }, orderBy: { position: "asc" }, select: { id: true } });
  await db.$transaction(lessons.map((l, i) => db.lesson.update({ where: { id: l.id }, data: { position: i } })));
}

/**
 * Reordena o currículo inteiro (módulos e aulas, inclusive aulas trocando de
 * módulo). O cliente envia a estrutura completa; validamos que ela contém
 * exatamente os módulos e aulas do curso.
 */
export async function reorderCurriculum(user: SessionUser, input: unknown) {
  const data = parseInput(reorderSchema, input);
  await assertCourseManager(user, data.courseId);
  const [mods, lessons] = await Promise.all([
    db.module.findMany({ where: { courseId: data.courseId }, select: { id: true } }),
    db.lesson.findMany({ where: { courseId: data.courseId }, select: { id: true } }),
  ]);
  const modSet = new Set(mods.map((m) => m.id));
  const lessonSet = new Set(lessons.map((l) => l.id));
  const sentLessons = data.modules.flatMap((m) => m.lessonIds);
  const valid =
    data.modules.length === modSet.size &&
    data.modules.every((m) => modSet.has(m.id)) &&
    new Set(data.modules.map((m) => m.id)).size === modSet.size &&
    sentLessons.length === lessonSet.size &&
    new Set(sentLessons).size === lessonSet.size &&
    sentLessons.every((id) => lessonSet.has(id));
  if (!valid) throw new AppError("O currículo mudou em outra aba. Recarregue a página e tente novamente.", "STALE", 409);

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  data.modules.forEach((m, mi) => {
    ops.push(db.module.update({ where: { id: m.id }, data: { position: mi } }));
    m.lessonIds.forEach((lid, li) => ops.push(db.lesson.update({ where: { id: lid }, data: { position: li, moduleId: m.id } })));
  });
  await db.$transaction(ops);
  await touchCourse(data.courseId);
}

// ── Aulas ────────────────────────────────────────────────────────────

async function ensureAssessment(lesson: { id: string; courseId: string; title: string; type: LessonType }) {
  if (lesson.type === "QUIZ") {
    const quiz = await db.quiz.findUnique({ where: { lessonId: lesson.id }, select: { id: true } });
    if (!quiz) await db.quiz.create({ data: { courseId: lesson.courseId, lessonId: lesson.id, title: lesson.title } });
  }
  if (lesson.type === "ASSIGNMENT") {
    const a = await db.assignment.findUnique({ where: { lessonId: lesson.id }, select: { id: true } });
    if (!a) await db.assignment.create({ data: { courseId: lesson.courseId, lessonId: lesson.id, title: lesson.title } });
  }
}

export async function createLesson(user: SessionUser, input: unknown) {
  const data = parseInput(newLessonSchema, input);
  const course = await assertCourseManager(user, data.courseId);
  let moduleId = data.moduleId ?? null;
  if (moduleId) {
    const mod = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
    if (!mod || mod.courseId !== course.id) throw new ValidationError(undefined, { moduleId: "Módulo inválido." });
  } else {
    const last = await db.module.findFirst({ where: { courseId: course.id }, orderBy: { position: "desc" } });
    moduleId = (last ?? (await db.module.create({ data: { courseId: course.id, title: "Módulo 1", position: 0 } }))).id;
  }
  const last = await db.lesson.aggregate({ where: { moduleId }, _max: { position: true } });
  // Em curso já publicado, aulas novas nascem como rascunho (o aluno não vê algo pela metade).
  const lesson = await db.lesson.create({
    data: {
      courseId: course.id,
      moduleId,
      title: data.title,
      type: data.type,
      videoProvider: data.type === "VIDEO" ? "YOUTUBE" : null,
      position: (last._max.position ?? -1) + 1,
      isPublished: course.status !== "PUBLISHED",
    },
  });
  await ensureAssessment(lesson);
  await touchCourse(course.id);
  await audit("lesson.created", { actorId: user.id, entityType: "lesson", entityId: lesson.id, metadata: { courseId: course.id, type: lesson.type } });
  return lesson;
}

async function copyLesson(lessonId: string, moduleId: string, position: number, asDraft: boolean) {
  const src = await db.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { materials: true, quiz: { include: { questions: { include: { options: true } } } }, assignment: true },
  });
  const copy = await db.lesson.create({
    data: {
      courseId: src.courseId,
      moduleId,
      title: src.title,
      summary: src.summary,
      type: src.type,
      content: src.content,
      videoProvider: src.videoProvider,
      videoUrl: src.videoUrl,
      mediaFileId: src.mediaFileId,
      externalUrl: src.externalUrl,
      captionsUrl: src.captionsUrl,
      durationSeconds: src.durationSeconds,
      position,
      isPreview: src.isPreview,
      isPublished: asDraft ? false : src.isPublished,
      materials: { create: src.materials.map((m) => ({ courseId: m.courseId, title: m.title, kind: m.kind, fileId: m.fileId, url: m.url, position: m.position })) },
    },
  });
  if (src.quiz) {
    const q = src.quiz;
    await db.quiz.create({
      data: {
        courseId: q.courseId, lessonId: copy.id, title: q.title, description: q.description, passingScore: q.passingScore, maxAttempts: q.maxAttempts,
        shuffleQuestions: q.shuffleQuestions, timeLimitMinutes: q.timeLimitMinutes, feedbackMode: q.feedbackMode, requiredToComplete: q.requiredToComplete,
        questions: {
          create: q.questions.map((x) => ({
            type: x.type, prompt: x.prompt, explanation: x.explanation, points: x.points, position: x.position, acceptedAnswers: x.acceptedAnswers,
            options: { create: x.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, position: o.position })) },
          })),
        },
      },
    });
  }
  if (src.assignment) {
    const a = src.assignment;
    await db.assignment.create({
      data: { courseId: a.courseId, lessonId: copy.id, title: a.title, instructions: a.instructions, dueAt: a.dueAt, maxScore: a.maxScore, passingScore: a.passingScore, allowText: a.allowText, allowFile: a.allowFile },
    });
  }
  return copy;
}

export async function duplicateLesson(user: SessionUser, lessonId: string) {
  const lesson = await assertLessonManager(user, lessonId);
  await db.lesson.updateMany({ where: { moduleId: lesson.moduleId, position: { gt: lesson.position } }, data: { position: { increment: 1 } } });
  const copy = await copyLesson(lesson.id, lesson.moduleId, lesson.position + 1, lesson.course.status === "PUBLISHED");
  await db.lesson.update({ where: { id: copy.id }, data: { title: `${lesson.title} (cópia)`.slice(0, 160) } });
  await syncCourseDuration(lesson.courseId);
  await audit("lesson.duplicated", { actorId: user.id, entityType: "lesson", entityId: copy.id, metadata: { from: lesson.id } });
  return copy;
}

export async function deleteLesson(user: SessionUser, lessonId: string) {
  const lesson = await assertLessonManager(user, lessonId);
  await db.lesson.delete({ where: { id: lesson.id } });
  await normalizeLessonPositions(lesson.moduleId);
  await syncCourseDuration(lesson.courseId);
  if (lesson.course.status === "PUBLISHED" && lesson.isPublished) await recomputeCourseProgress(lesson.courseId);
  await audit("lesson.deleted", { actorId: user.id, entityType: "lesson", entityId: lesson.id, metadata: { courseId: lesson.courseId, title: lesson.title } });
}

export async function setLessonPublished(user: SessionUser, lessonId: string, published: boolean) {
  const lesson = await assertLessonManager(user, lessonId);
  if (lesson.isPublished === published) return;
  await db.lesson.update({ where: { id: lesson.id }, data: { isPublished: published } });
  await syncCourseDuration(lesson.courseId);
  await audit(published ? "lesson.published" : "lesson.unpublished", { actorId: user.id, entityType: "lesson", entityId: lesson.id });
  if (lesson.course.status === "PUBLISHED") {
    await recomputeCourseProgress(lesson.courseId);
    if (published) await notifyNewContent(lesson);
  }
}

async function notifyNewContent(lesson: { id: string; courseId: string; title: string; type: LessonType; course: { title: string } }) {
  const enrolled = await db.enrollment.findMany({ where: { courseId: lesson.courseId, status: "ACTIVE" }, select: { userId: true } });
  const assignment = lesson.type === "ASSIGNMENT";
  await notify(
    enrolled.map((e) => e.userId),
    {
      type: assignment ? "NEW_ASSIGNMENT" : "NEW_LESSON",
      title: assignment ? `Nova atividade em ${lesson.course.title}` : `Nova aula em ${lesson.course.title}`,
      body: lesson.title,
      link: `/learn/${lesson.courseId}/${lesson.id}`,
    },
  );
}

export async function setLessonPreview(user: SessionUser, lessonId: string, preview: boolean) {
  const lesson = await assertLessonManager(user, lessonId);
  await db.lesson.update({ where: { id: lesson.id }, data: { isPreview: preview } });
}

export async function getLessonForEdit(user: SessionUser, courseId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: { select: { id: true, title: true, slug: true, status: true, instructorId: true } },
      module: { select: { id: true, title: true } },
      mediaFile: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
      materials: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { file: { select: { originalName: true, mimeType: true, sizeBytes: true } } } },
      quiz: {
        include: {
          questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } },
          _count: { select: { attempts: true } },
        },
      },
      assignment: { include: { _count: { select: { submissions: true } } } },
    },
  });
  if (!lesson || lesson.courseId !== courseId) throw new NotFoundError("Aula não encontrada.");
  if (!canManageCourse(user, lesson.course)) throw new ForbiddenError("Você não pode editar este curso.");
  return lesson;
}

export async function updateLesson(user: SessionUser, input: unknown) {
  const data = parseInput(lessonSchema, input);
  const lesson = await assertLessonManager(user, data.lessonId);
  if (data.mediaFileId) {
    const f = await db.fileAsset.findUnique({ where: { id: data.mediaFileId }, select: { ownerId: true } });
    const ok = f && (f.ownerId === user.id || user.permissions.has("courses.manage_any") || data.mediaFileId === lesson.mediaFileId);
    if (!ok) throw new ValidationError(undefined, { mediaFileId: "Arquivo inválido." });
  }
  if (data.type === "LINK" && !data.externalUrl) throw new ValidationError(undefined, { externalUrl: "Informe o endereço do link." });
  if (lesson.type !== data.type && (lesson.type === "QUIZ" || lesson.type === "ASSIGNMENT")) {
    const used =
      lesson.type === "QUIZ"
        ? await db.quizAttempt.count({ where: { quiz: { lessonId: lesson.id } } })
        : await db.assignmentSubmission.count({ where: { assignment: { lessonId: lesson.id } } });
    if (used) throw new ValidationError(`Esta aula já tem ${used} resposta(s) de alunos. Não é possível trocar o tipo.`, { type: "Tipo bloqueado: já há respostas de alunos." });
  }
  const isVideo = data.type === "VIDEO";
  const updated = await db.lesson.update({
    where: { id: lesson.id },
    data: {
      title: data.title,
      summary: data.summary ?? null,
      type: data.type,
      content: data.content,
      videoProvider: isVideo ? (data.videoProvider ?? "URL") : null,
      videoUrl: isVideo ? (data.videoUrl ?? null) : null,
      captionsUrl: isVideo ? (data.captionsUrl ?? null) : null,
      externalUrl: data.type === "LINK" ? (data.externalUrl ?? null) : null,
      mediaFileId: ["PDF", "AUDIO", "PRESENTATION", "FILE"].includes(data.type) || (isVideo && data.videoProvider === "UPLOAD") ? (data.mediaFileId ?? null) : null,
      durationSeconds: data.durationMinutes * 60 + data.durationSecondsPart,
      isPreview: data.isPreview,
    },
  });
  // Título da avaliação acompanha o da aula.
  if (updated.type === "QUIZ") await db.quiz.updateMany({ where: { lessonId: lesson.id }, data: { title: updated.title } });
  if (updated.type === "ASSIGNMENT") await db.assignment.updateMany({ where: { lessonId: lesson.id }, data: { title: updated.title } });
  await ensureAssessment(updated);
  await syncCourseDuration(lesson.courseId);
  await audit("lesson.updated", { actorId: user.id, entityType: "lesson", entityId: lesson.id, metadata: { type: data.type } });
  return updated;
}

// ── Materiais ────────────────────────────────────────────────────────

export async function addMaterial(user: SessionUser, input: unknown) {
  const data = parseInput(materialSchema, input);
  const lesson = await assertLessonManager(user, data.lessonId);
  if (data.kind === "FILE") {
    const f = await db.fileAsset.findUnique({ where: { id: data.fileId! }, select: { ownerId: true } });
    if (!f || (f.ownerId !== user.id && !user.permissions.has("courses.manage_any"))) throw new ValidationError(undefined, { fileId: "Arquivo inválido." });
  }
  const last = await db.material.aggregate({ where: { lessonId: lesson.id }, _max: { position: true } });
  const m = await db.material.create({
    data: {
      courseId: lesson.courseId,
      lessonId: lesson.id,
      title: data.title,
      kind: data.kind,
      fileId: data.kind === "FILE" ? data.fileId : null,
      url: data.kind === "LINK" ? data.url : null,
      position: (last._max.position ?? -1) + 1,
    },
  });
  await audit("material.added", { actorId: user.id, entityType: "material", entityId: m.id, metadata: { lessonId: lesson.id } });
  return m;
}

export async function removeMaterial(user: SessionUser, materialId: string) {
  const m = await db.material.findUnique({ where: { id: materialId }, include: { course: true } });
  if (!m) throw new NotFoundError("Material não encontrado.");
  if (!canManageCourse(user, m.course)) throw new ForbiddenError();
  await db.material.delete({ where: { id: m.id } });
  await audit("material.removed", { actorId: user.id, entityType: "material", entityId: m.id, metadata: { lessonId: m.lessonId } });
}

// ── Questionário ─────────────────────────────────────────────────────

async function quizForLesson(user: SessionUser, lessonId: string) {
  const lesson = await assertLessonManager(user, lessonId);
  if (lesson.type !== "QUIZ") throw new AppError("Esta aula não é um questionário.");
  await ensureAssessment(lesson);
  const quiz = await db.quiz.findUniqueOrThrow({ where: { lessonId } });
  return { lesson, quiz };
}

export async function updateQuizSettings(user: SessionUser, input: unknown) {
  const data = parseInput(quizSettingsSchema, input);
  const { quiz } = await quizForLesson(user, data.lessonId);
  await db.quiz.update({
    where: { id: quiz.id },
    data: {
      passingScore: data.passingScore,
      maxAttempts: data.maxAttempts,
      shuffleQuestions: data.shuffleQuestions,
      timeLimitMinutes: data.timeLimitMinutes ? data.timeLimitMinutes : null,
      feedbackMode: data.feedbackMode,
      requiredToComplete: data.requiredToComplete,
    },
  });
  await audit("quiz.updated", { actorId: user.id, entityType: "quiz", entityId: quiz.id });
}

export async function saveQuestion(user: SessionUser, input: unknown) {
  const data = parseInput(questionSchema, input);
  const { quiz } = await quizForLesson(user, data.lessonId);
  const options =
    data.type === "SHORT_ANSWER" || data.type === "ESSAY"
      ? []
      : data.type === "TRUE_FALSE"
        ? data.options.slice(0, 2)
        : data.options;
  const fields = {
    type: data.type,
    prompt: data.prompt,
    explanation: data.explanation ?? null,
    points: data.points,
    acceptedAnswers: data.type === "SHORT_ANSWER" ? data.acceptedAnswers : [],
  };
  if (data.questionId) {
    const q = await db.question.findUnique({ where: { id: data.questionId }, select: { quizId: true } });
    if (!q || q.quizId !== quiz.id) throw new NotFoundError("Questão não encontrada.");
    await db.$transaction([
      db.question.update({ where: { id: data.questionId }, data: fields }),
      db.questionOption.deleteMany({ where: { questionId: data.questionId } }),
      db.questionOption.createMany({ data: options.map((o, i) => ({ questionId: data.questionId!, text: o.text, isCorrect: o.isCorrect, position: i })) }),
    ]);
    return data.questionId;
  }
  const last = await db.question.aggregate({ where: { quizId: quiz.id }, _max: { position: true } });
  const q = await db.question.create({
    data: {
      ...fields,
      quizId: quiz.id,
      position: (last._max.position ?? -1) + 1,
      options: { create: options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, position: i })) },
    },
  });
  await audit("quiz.question_added", { actorId: user.id, entityType: "quiz", entityId: quiz.id, metadata: { questionId: q.id } });
  return q.id;
}

async function assertQuestionManager(user: SessionUser, questionId: string) {
  const q = await db.question.findUnique({ where: { id: questionId }, include: { quiz: { include: { course: true } } } });
  if (!q) throw new NotFoundError("Questão não encontrada.");
  if (!canManageCourse(user, q.quiz.course)) throw new ForbiddenError();
  return q;
}

export async function deleteQuestion(user: SessionUser, questionId: string) {
  const q = await assertQuestionManager(user, questionId);
  await db.question.delete({ where: { id: q.id } });
  const rest = await db.question.findMany({ where: { quizId: q.quizId }, orderBy: { position: "asc" }, select: { id: true } });
  await db.$transaction(rest.map((r, i) => db.question.update({ where: { id: r.id }, data: { position: i } })));
  await audit("quiz.question_deleted", { actorId: user.id, entityType: "quiz", entityId: q.quizId, metadata: { questionId: q.id } });
}

export async function moveQuestion(user: SessionUser, questionId: string, direction: "up" | "down") {
  const q = await assertQuestionManager(user, questionId);
  const all = await db.question.findMany({ where: { quizId: q.quizId }, orderBy: { position: "asc" }, select: { id: true } });
  const i = all.findIndex((x) => x.id === q.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((r, k) => db.question.update({ where: { id: r.id }, data: { position: k } })));
}

// ── Atividade ────────────────────────────────────────────────────────

export async function updateAssignment(user: SessionUser, input: unknown) {
  const data = parseInput(assignmentSchema, input);
  const lesson = await assertLessonManager(user, data.lessonId);
  if (lesson.type !== "ASSIGNMENT") throw new AppError("Esta aula não é uma atividade.");
  await ensureAssessment(lesson);
  let dueAt: Date | null = null;
  if (data.dueAt) {
    dueAt = new Date(data.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new ValidationError(undefined, { dueAt: "Data inválida." });
  }
  const a = await db.assignment.update({
    where: { lessonId: lesson.id },
    data: {
      instructions: data.instructions,
      dueAt,
      maxScore: data.maxScore,
      passingScore: data.passingScore,
      allowText: data.allowText,
      allowFile: data.allowFile,
    },
  });
  await audit("assignment.updated", { actorId: user.id, entityType: "assignment", entityId: a.id });
}

// ── Consultas auxiliares do builder ──────────────────────────────────

export async function builderLookups() {
  const [categories, tags, templates] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 300 }),
    db.certificateTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, isDefault: true } }),
  ]);
  return { categories, tags, templates };
}
