import "server-only";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { canManageCourse } from "./access";

/**
 * Autorização de download. Arquivos PUBLIC (capas, banners, avatares, logo)
 * são livres. PRIVATE exigem vínculo: dono; material/aula de curso em que está
 * matriculado ou que gerencia; entrega própria ou de curso que corrige;
 * anexo de conversa da qual participa; ou permissão administrativa.
 */
export async function canReadFile(user: SessionUser | null, fileId: string) {
  const file = await db.fileAsset.findUnique({
    where: { id: fileId },
    include: {
      materials: { select: { courseId: true, course: { select: { instructorId: true } } } },
      lessons: { select: { courseId: true, isPreview: true, course: { select: { instructorId: true, status: true } } } },
      submissions: { select: { userId: true, assignment: { select: { course: { select: { instructorId: true } } } } } },
      messages: { select: { conversationId: true } },
    },
  });
  if (!file) return { file: null, allowed: false };
  if (file.visibility === "PUBLIC") return { file, allowed: true };
  if (!user) return { file, allowed: false };
  if (file.ownerId === user.id || user.permissions.has("courses.manage_any")) return { file, allowed: true };

  const courseIds = [...file.materials.map((m) => m.courseId), ...file.lessons.map((l) => l.courseId)];
  for (const m of file.materials) if (canManageCourse(user, m.course)) return { file, allowed: true };
  for (const l of file.lessons) {
    if (canManageCourse(user, l.course)) return { file, allowed: true };
    if (l.isPreview && l.course.status === "PUBLISHED") return { file, allowed: true };
  }
  if (courseIds.length) {
    const enrolled = await db.enrollment.count({ where: { userId: user.id, courseId: { in: courseIds }, status: { not: "CANCELLED" } } });
    if (enrolled) return { file, allowed: true };
  }
  for (const s of file.submissions) {
    if (s.userId === user.id) return { file, allowed: true };
    if (user.permissions.has("grading.own") && s.assignment.course.instructorId === user.id) return { file, allowed: true };
  }
  if (file.messages.length) {
    const part = await db.conversationParticipant.count({ where: { userId: user.id, conversationId: { in: file.messages.map((m) => m.conversationId) } } });
    if (part) return { file, allowed: true };
  }
  return { file, allowed: false };
}
