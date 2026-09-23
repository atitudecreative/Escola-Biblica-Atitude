import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { parseInput } from "@/server/action";
import type { SessionUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { announcementSchema, type AnnouncementInput } from "@/lib/validation/teacher";
import { canManageCourse } from "./access";
import { notify } from "./notifications";

/**
 * Comunicados. Regras:
 *  - COURSE: exige `announcements.all`, ou `announcements.course` + ser gestor do curso.
 *  - ALL / ROLE / USER: exigem `announcements.all`.
 * Os destinatários recebem uma notificação interna (tipo ANNOUNCEMENT).
 */
export async function sendAnnouncement(user: SessionUser, input: AnnouncementInput | unknown) {
  const data = parseInput(announcementSchema, input);
  const all = user.permissions.has("announcements.all");

  let recipientIds: string[] = [];
  let courseTitle: string | null = null;

  if (data.audience === "COURSE") {
    const course = await db.course.findUnique({ where: { id: data.courseId! }, select: { id: true, title: true, instructorId: true } });
    if (!course) throw new NotFoundError("Curso não encontrado.");
    const allowed = all || (user.permissions.has("announcements.course") && canManageCourse(user, course));
    if (!allowed) throw new ForbiddenError("Você só pode enviar comunicados para turmas dos seus cursos.");
    courseTitle = course.title;
    const enrollments = await db.enrollment.findMany({
      where: { courseId: course.id, status: { not: "CANCELLED" }, user: { status: "ACTIVE" } },
      select: { userId: true },
    });
    recipientIds = enrollments.map((e) => e.userId);
  } else {
    if (!all) throw new ForbiddenError("Você não pode enviar comunicados para este público.");
    if (data.audience === "ALL") {
      recipientIds = (await db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);
    } else if (data.audience === "ROLE") {
      recipientIds = (
        await db.user.findMany({ where: { status: "ACTIVE", roles: { some: { role: { key: data.roleKey! } } } }, select: { id: true } })
      ).map((u) => u.id);
    } else {
      const target = await db.user.findUnique({ where: { id: data.targetUserId! }, select: { id: true } });
      if (!target) throw new NotFoundError("Destinatário não encontrado.");
      recipientIds = [target.id];
    }
  }

  // O autor não recebe o próprio comunicado como notificação.
  recipientIds = recipientIds.filter((id) => id !== user.id);

  const announcement = await db.announcement.create({
    data: {
      authorId: user.id,
      title: data.title,
      body: data.body,
      audience: data.audience,
      courseId: data.audience === "COURSE" ? data.courseId : null,
      roleKey: data.audience === "ROLE" ? data.roleKey : null,
      targetUserId: data.audience === "USER" ? data.targetUserId : null,
      recipients: recipientIds.length,
    },
  });

  await notify(recipientIds, {
    type: "ANNOUNCEMENT",
    title: courseTitle ? `${courseTitle}: ${data.title}` : data.title,
    body: data.body.length > 180 ? `${data.body.slice(0, 177)}…` : data.body,
    link: `/announcements#${announcement.id}`,
  });
  await audit("announcement.sent", {
    actorId: user.id,
    entityType: "announcement",
    entityId: announcement.id,
    metadata: { audience: data.audience, courseId: data.courseId ?? null, recipients: recipientIds.length },
  });
  return announcement;
}

/**
 * Comunicados visíveis para o usuário: gerais, do seu perfil, dos cursos em que
 * está matriculado ou que gerencia, direcionados a ele, ou escritos por ele.
 */
export async function listAnnouncementsFor(user: SessionUser, opts: { take?: number; courseId?: string } = {}) {
  const [enrolled, managed] = await Promise.all([
    db.enrollment.findMany({ where: { userId: user.id, status: { not: "CANCELLED" } }, select: { courseId: true } }),
    user.permissions.has("courses.manage_any")
      ? Promise.resolve(null)
      : db.course.findMany({ where: { instructorId: user.id }, select: { id: true } }),
  ]);
  const courseIds = [...enrolled.map((e) => e.courseId), ...(managed ?? []).map((c) => c.id)];
  const courseFilter: Prisma.AnnouncementWhereInput =
    managed === null ? { audience: "COURSE" } : { audience: "COURSE", courseId: { in: courseIds } };

  const where: Prisma.AnnouncementWhereInput = {
    AND: [
      {
        OR: [
          { audience: "ALL" },
          { audience: "ROLE", roleKey: { in: user.roles } },
          courseFilter,
          { audience: "USER", targetUserId: user.id },
          { authorId: user.id },
        ],
      },
      opts.courseId ? { courseId: opts.courseId } : {},
    ],
  };

  return db.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, headline: true } },
      course: { select: { id: true, title: true, slug: true } },
      targetUser: { select: { id: true, name: true } },
    },
  });
}
