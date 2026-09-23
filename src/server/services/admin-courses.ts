import "server-only";
import type { CourseStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertPermission } from "@/server/auth/guards";
import { NotFoundError, ValidationError } from "@/server/errors";
import { notify } from "./notifications";
import { emitWebhook } from "./webhooks";

/**
 * Administração de cursos (visão da plataforma inteira).
 * Leitura: courses.view_all · Ações: courses.manage_any.
 */

export const ADMIN_COURSES_PAGE_SIZE = 20;

const SORTS = {
  title: "title",
  updated: "updatedAt",
  created: "createdAt",
  enrollments: "enrollmentCount",
  rating: "ratingAvg",
} as const;
export type AdminCourseSort = keyof typeof SORTS;

export type AdminCourseFilters = {
  q?: string;
  status?: string;
  category?: string;
  teacher?: string;
  featured?: string;
  sort?: string;
  dir?: string;
  page: number;
};

export async function listAdminCourses(f: AdminCourseFilters) {
  await assertPermission("courses.view_all", "courses.manage_any");
  const where: Prisma.CourseWhereInput = {};
  if (f.q) where.OR = [{ title: { contains: f.q, mode: "insensitive" } }, { slug: { contains: f.q, mode: "insensitive" } }];
  if (f.status && ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"].includes(f.status)) where.status = f.status as CourseStatus;
  if (f.category === "none") where.categoryId = null;
  else if (f.category) where.categoryId = f.category;
  if (f.teacher) where.instructorId = f.teacher;
  if (f.featured === "1") where.isFeatured = true;

  const sortField = SORTS[(f.sort as AdminCourseSort) ?? "updated"] ?? "updatedAt";
  const dir: Prisma.SortOrder = f.dir === "asc" ? "asc" : "desc";

  const [total, rows] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where,
      orderBy: [{ [sortField]: dir }, { id: "asc" }],
      skip: (f.page - 1) * ADMIN_COURSES_PAGE_SIZE,
      take: ADMIN_COURSES_PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        coverUrl: true,
        status: true,
        isFeatured: true,
        enrollmentCount: true,
        ratingAvg: true,
        ratingCount: true,
        updatedAt: true,
        publishedAt: true,
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { lessons: true } },
      },
    }),
  ]);
  return { total, rows };
}

export async function courseReviewQueue() {
  await assertPermission("courses.view_all", "courses.manage_any");
  const courses = await db.course.findMany({
    where: { status: "REVIEW" },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      coverUrl: true,
      updatedAt: true,
      workloadHours: true,
      category: { select: { name: true } },
      instructor: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { lessons: true, modules: true } },
    },
  });
  // Quando o curso foi enviado para revisão (auditoria), se houver registro.
  const logs = courses.length
    ? await db.auditLog.findMany({
        where: { action: "course.submitted_for_review", entityType: "course", entityId: { in: courses.map((c) => c.id) } },
        orderBy: { createdAt: "desc" },
        select: { entityId: true, createdAt: true },
      })
    : [];
  const submitted = new Map<string, Date>();
  for (const l of logs) if (l.entityId && !submitted.has(l.entityId)) submitted.set(l.entityId, l.createdAt);
  return courses.map((c) => ({ ...c, submittedAt: submitted.get(c.id) ?? c.updatedAt }));
}

export async function adminCourseFilterOptions() {
  await assertPermission("courses.view_all", "courses.manage_any");
  const [categories, teachers, counts] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    listEligibleInstructors(),
    db.course.groupBy({ by: ["status"], _count: true }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<CourseStatus, number>>;
  return { categories, teachers, byStatus };
}

/** Usuários que podem ser professores responsáveis: quem tem perfil com permissão de criar/gerir cursos. */
export async function listEligibleInstructors() {
  return db.user.findMany({
    where: {
      status: "ACTIVE",
      roles: {
        some: { role: { permissions: { some: { permission: { key: { in: ["courses.manage_own", "courses.create", "courses.manage_any"] } } } } } },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
}

async function publish(courseIds: string[], actorId: string, reason: "approved" | "bulk") {
  const courses = await db.course.findMany({
    where: { id: { in: courseIds }, status: { not: "PUBLISHED" } },
    select: { id: true, slug: true, title: true, instructorId: true, publishedAt: true, _count: { select: { lessons: true } } },
  });
  const empty = courses.filter((c) => c._count.lessons === 0);
  if (empty.length && courses.length === 1)
    throw new ValidationError("O curso não tem nenhuma aula. Peça ao professor para adicionar conteúdo antes de publicar.");
  const ok = courses.filter((c) => c._count.lessons > 0);
  const now = new Date();
  for (const c of ok) {
    await db.course.update({ where: { id: c.id }, data: { status: "PUBLISHED", publishedAt: c.publishedAt ?? now } });
    await notify(c.instructorId, {
      type: "COURSE",
      title: reason === "approved" ? "Seu curso foi aprovado e publicado" : "Seu curso foi publicado",
      body: `"${c.title}" já está disponível no catálogo.`,
      link: `/teacher/courses/${c.id}`,
    });
    await audit("course.published", { actorId, entityType: "course", entityId: c.id, metadata: { reason } });
    emitWebhook("course.published", { courseId: c.id, slug: c.slug, title: c.title });
  }
  return { published: ok.length, skipped: empty.length };
}

export async function approveCourse(courseId: string) {
  const actor = await assertPermission("courses.manage_any");
  const course = await db.course.findUnique({ where: { id: courseId }, select: { status: true } });
  if (!course) throw new NotFoundError("Curso não encontrado.");
  if (course.status === "PUBLISHED") throw new ValidationError("Este curso já está publicado.");
  return publish([courseId], actor.id, "approved");
}

export async function returnCourse(courseId: string, comment: string) {
  const actor = await assertPermission("courses.manage_any");
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, status: true, instructorId: true } });
  if (!course) throw new NotFoundError("Curso não encontrado.");
  if (course.status !== "REVIEW") throw new ValidationError("Apenas cursos em revisão podem ser devolvidos.");
  await db.course.update({ where: { id: courseId }, data: { status: "DRAFT" } });
  await notify(course.instructorId, {
    type: "COURSE",
    title: "Seu curso voltou para ajustes",
    body: `"${course.title}": ${comment}`.slice(0, 500),
    link: `/teacher/courses/${course.id}`,
  });
  await audit("course.returned", { actorId: actor.id, entityType: "course", entityId: course.id, metadata: { comment } });
}

export async function bulkCourseStatus(ids: string[], action: "publish" | "archive") {
  const actor = await assertPermission("courses.manage_any");
  if (action === "publish") return publish(ids, actor.id, "bulk");
  const res = await db.course.updateMany({ where: { id: { in: ids }, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED", isFeatured: false } });
  for (const id of ids) await audit("course.archived", { actorId: actor.id, entityType: "course", entityId: id });
  return { published: 0, skipped: 0, archived: res.count };
}

export async function setCourseFeatured(courseId: string, featured: boolean) {
  const actor = await assertPermission("courses.manage_any");
  const course = await db.course.findUnique({ where: { id: courseId }, select: { status: true } });
  if (!course) throw new NotFoundError("Curso não encontrado.");
  if (featured && course.status !== "PUBLISHED") throw new ValidationError("Só cursos publicados podem ser destacados na home.");
  await db.course.update({ where: { id: courseId }, data: { isFeatured: featured } });
  await audit(featured ? "course.featured" : "course.unfeatured", { actorId: actor.id, entityType: "course", entityId: courseId });
}

export async function changeCourseInstructor(courseId: string, instructorId: string) {
  const actor = await assertPermission("courses.manage_any");
  const [course, eligible] = await Promise.all([
    db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, instructorId: true } }),
    listEligibleInstructors(),
  ]);
  if (!course) throw new NotFoundError("Curso não encontrado.");
  if (!eligible.some((u) => u.id === instructorId)) throw new ValidationError("Escolha um professor ativo.", { instructorId: "Escolha um professor ativo." });
  if (course.instructorId === instructorId) return;
  await db.course.update({ where: { id: courseId }, data: { instructorId } });
  await notify(instructorId, {
    type: "COURSE",
    title: "Você é o novo responsável por um curso",
    body: `"${course.title}" foi atribuído a você.`,
    link: `/teacher/courses/${course.id}`,
  });
  await audit("course.instructor_changed", {
    actorId: actor.id,
    entityType: "course",
    entityId: courseId,
    metadata: { from: course.instructorId, to: instructorId },
  });
}
