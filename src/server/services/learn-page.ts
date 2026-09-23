import "server-only";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { lessonAccess } from "./access";
import { lockedLessonIds, markLessonOpened } from "./learning";
import { assignmentStateFor, quizStateFor } from "./assessments";

/** Tudo que a tela de aula precisa, com autorização aplicada. */
export async function getLearnData(user: SessionUser, courseId: string, lessonId: string) {
  const access = await lessonAccess(user, lessonId);
  if (!access.lesson || access.lesson.courseId !== courseId) return { status: "not_found" as const };
  if (!access.allowed) return { status: access.reason === "not_enrolled" ? ("not_enrolled" as const) : ("unavailable" as const), slug: access.lesson.course.slug };

  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: {
      id: true, slug: true, title: true, sequential: true, instructorId: true, certificateEnabled: true,
      instructor: { select: { id: true, name: true } },
      modules: {
        orderBy: { position: "asc" },
        select: {
          id: true, title: true,
          lessons: { where: access.manager ? {} : { isPublished: true }, orderBy: { position: "asc" }, select: { id: true, title: true, type: true, durationSeconds: true, isPreview: true, isPublished: true } },
        },
      },
    },
  });

  const enrollment = access.enrollment;
  const [progress, locked, lesson, isFavorite, comments, certificate] = await Promise.all([
    enrollment ? db.lessonProgress.findMany({ where: { userId: user.id, courseId }, select: { lessonId: true, status: true, positionSeconds: true } }) : Promise.resolve([]),
    enrollment ? lockedLessonIds(courseId, user.id, course.sequential) : Promise.resolve(new Set<string>()),
    db.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: {
        mediaFile: { select: { id: true, mimeType: true, originalName: true, sizeBytes: true } },
        materials: { orderBy: { position: "asc" }, include: { file: { select: { id: true, mimeType: true, originalName: true, sizeBytes: true } } } },
        quiz: { select: { id: true } },
        assignment: { select: { id: true } },
        module: { select: { title: true } },
      },
    }),
    db.favorite.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } }),
    db.lessonComment.findMany({
      where: { lessonId, parentId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, roles: { select: { role: { select: { key: true } } } } } },
        replies: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, avatarUrl: true, roles: { select: { role: { select: { key: true } } } } } } } },
      },
    }),
    enrollment ? db.certificate.findUnique({ where: { enrollmentId: enrollment.id }, select: { code: true } }) : Promise.resolve(null),
  ]);

  const flat = course.modules.flatMap((m) => m.lessons);
  const idx = flat.findIndex((l) => l.id === lessonId);
  const progressMap = new Map(progress.map((p) => [p.lessonId, p]));
  const isLocked = locked.has(lessonId);

  if (enrollment && !isLocked) await markLessonOpened(user.id, courseId, lessonId);

  const [quiz, assignment] = await Promise.all([
    lesson.quiz && !isLocked ? quizStateFor(user, lesson.quiz.id) : Promise.resolve(null),
    lesson.assignment && !isLocked ? assignmentStateFor(user, lesson.assignment.id) : Promise.resolve(null),
  ]);
  const favoriteMaterials = new Set(
    (await db.favorite.findMany({ where: { userId: user.id, materialId: { in: lesson.materials.map((m) => m.id) } }, select: { materialId: true } })).map((f) => f.materialId!),
  );
  const firstLocked = flat.find((l) => locked.has(l.id));
  const requiredBefore = isLocked ? flat.slice(0, idx).reverse().find((l) => progressMap.get(l.id)?.status !== "COMPLETED" && !locked.has(l.id)) : null;

  return {
    status: "ok" as const,
    manager: access.manager,
    enrolled: !!enrollment,
    enrollment,
    certificateCode: certificate?.code ?? null,
    course,
    lesson,
    isLocked,
    requiredBefore: requiredBefore ?? (isLocked ? firstLocked : null),
    completed: progressMap.get(lessonId)?.status === "COMPLETED",
    resumeAt: progressMap.get(lessonId)?.positionSeconds ?? 0,
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null,
    outline: course.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({ ...l, completed: progressMap.get(l.id)?.status === "COMPLETED", locked: locked.has(l.id) })),
    })),
    totals: { lessons: flat.length, completed: flat.filter((l) => progressMap.get(l.id)?.status === "COMPLETED").length },
    isFavorite: !!isFavorite,
    favoriteMaterials,
    comments,
    quiz,
    assignment,
  };
}
