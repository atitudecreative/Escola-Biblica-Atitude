import "server-only";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";

/** Regras de acesso a cursos, centralizadas. */
export function canManageCourse(user: SessionUser | null, course: { instructorId: string }) {
  if (!user) return false;
  if (user.permissions.has("courses.manage_any")) return true;
  return user.permissions.has("courses.manage_own") && course.instructorId === user.id;
}

export function canViewCourseAnalytics(user: SessionUser, course: { instructorId: string }) {
  return canManageCourse(user, course) || user.permissions.has("courses.view_all");
}

export async function assertCourseManager(user: SessionUser, courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError("Curso não encontrado.");
  if (!canManageCourse(user, course)) throw new ForbiddenError("Você não pode editar este curso.");
  return course;
}

/**
 * Pode assistir à aula se: gerencia o curso; é aula de prévia de curso publicado;
 * ou está matriculado (ativo/concluído) em curso publicado/arquivado.
 */
export async function lessonAccess(user: SessionUser | null, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { course: true, module: { select: { position: true } } },
  });
  if (!lesson) return { lesson: null, allowed: false as const, reason: "not_found" as const };
  const course = lesson.course;
  if (user && canManageCourse(user, course)) return { lesson, allowed: true as const, manager: true, enrollment: null };
  if (!lesson.isPublished || course.status === "DRAFT" || course.status === "REVIEW") {
    return { lesson, allowed: false as const, reason: "unavailable" as const };
  }
  const enrollment = user
    ? await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } })
    : null;
  const enrolled = !!enrollment && enrollment.status !== "CANCELLED";
  if (enrolled) return { lesson, allowed: true as const, manager: false, enrollment };
  if (lesson.isPreview && course.status === "PUBLISHED") return { lesson, allowed: true as const, manager: false, enrollment: null };
  return { lesson, allowed: false as const, reason: "not_enrolled" as const };
}
