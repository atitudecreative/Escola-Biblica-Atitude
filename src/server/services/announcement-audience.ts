import "server-only";
import { after } from "next/server";
import { sendEmail } from "@/server/email";
import { getSettings } from "@/server/settings";
import { logger } from "@/server/logger";
import { filterRecipients } from "./preferences";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { parseInput } from "@/server/action";
import type { SessionUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { announcementSchema } from "@/lib/validation/teacher";
import { canManageCourse } from "./access";

/**
 * Apoio à tela de comunicados (complementa services/announcements.ts, que envia
 * e lista os recebidos): prévia de alcance, cursos elegíveis, busca de
 * destinatário individual e histórico de enviados. As regras de permissão são
 * as mesmas de `sendAnnouncement`.
 */

export function canAnnounce(user: SessionUser) {
  return user.permissions.has("announcements.all") || user.permissions.has("announcements.course");
}

/** Quantas pessoas o comunicado atingirá (mesmo cálculo do envio, sem o autor). */
export async function countAudience(user: SessionUser, input: unknown) {
  const data = parseInput(announcementSchema, input);
  const all = user.permissions.has("announcements.all");
  const notMe = { id: { not: user.id } };
  if (data.audience === "COURSE") {
    const course = await db.course.findUnique({ where: { id: data.courseId! }, select: { id: true, instructorId: true } });
    if (!course) throw new NotFoundError("Curso não encontrado.");
    if (!(all || (user.permissions.has("announcements.course") && canManageCourse(user, course)))) throw new ForbiddenError("Você só pode enviar comunicados para turmas dos seus cursos.");
    return db.enrollment.count({ where: { courseId: course.id, status: { not: "CANCELLED" }, user: { status: "ACTIVE", ...notMe } } });
  }
  if (!all) throw new ForbiddenError("Você não pode enviar comunicados para este público.");
  if (data.audience === "ALL") return db.user.count({ where: { status: "ACTIVE", ...notMe } });
  if (data.audience === "ROLE") return db.user.count({ where: { status: "ACTIVE", ...notMe, roles: { some: { role: { key: data.roleKey! } } } } });
  const target = await db.user.findUnique({ where: { id: data.targetUserId! }, select: { id: true } });
  if (!target) throw new NotFoundError("Destinatário não encontrado.");
  return target.id === user.id ? 0 : 1;
}

/** Cursos para o público "curso": todos (announcements.all) ou os próprios. */
export async function announcementCourses(user: SessionUser) {
  if (!canAnnounce(user)) return [];
  const where: Prisma.CourseWhereInput = user.permissions.has("announcements.all")
    ? { status: { not: "ARCHIVED" } }
    : user.permissions.has("courses.manage_any")
      ? {}
      : { instructorId: user.id };
  const rows = await db.course.findMany({
    where,
    select: { id: true, title: true, _count: { select: { enrollments: { where: { status: { not: "CANCELLED" } } } } } },
    orderBy: { title: "asc" },
    take: 200,
  });
  return rows.map((c) => ({ id: c.id, title: c.title, students: c._count.enrollments }));
}

export async function searchAnnouncementTargets(user: SessionUser, q: string) {
  if (!user.permissions.has("announcements.all")) throw new ForbiddenError();
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  return db.user.findMany({
    where: { status: "ACTIVE", OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: "asc" },
    take: 8,
  });
}

export async function listSentAnnouncements(user: SessionUser) {
  if (!canAnnounce(user)) return [];
  return db.announcement.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, headline: true } },
      course: { select: { id: true, title: true, slug: true } },
      targetUser: { select: { id: true, name: true } },
    },
  });
}

/**
 * Fan-out de e-mail do comunicado: roda depois da resposta (after), só se
 * `communication.emailNotifications` estiver ligado, respeitando a preferência
 * de e-mail de cada pessoa. Envia em lotes de 20; falhas individuais ficam
 * registradas no outbox/log e não interrompem os demais envios.
 */
export function scheduleAnnouncementEmails(recipientIds: string[], a: { id: string; title: string; body: string }) {
  if (!recipientIds.length) return;
  const run = async () => {
    try {
      const settings = await getSettings("communication");
      if (!settings.emailNotifications) return;
      const allowed = await filterRecipients(recipientIds, "ANNOUNCEMENT", "email");
      const users = await db.user.findMany({ where: { id: { in: allowed }, status: "ACTIVE" }, select: { email: true, name: true } });
      for (let i = 0; i < users.length; i += 20) {
        const batch = users.slice(i, i + 20);
        const results = await Promise.allSettled(
          batch.map((u) => sendEmail(u.email, "announcement", { name: u.name, title: a.title, body: a.body, url: `/announcements#${a.id}` })),
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed) logger.error("announcement.email_batch_failed", { announcementId: a.id, failed, category: "infra" });
      }
    } catch (error) {
      logger.error("announcement.email_failed", { announcementId: a.id, error, category: "infra" });
    }
  };
  try {
    after(run);
  } catch {
    void run(); // fora de um contexto de requisição
  }
}
