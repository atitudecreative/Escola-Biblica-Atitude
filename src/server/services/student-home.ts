import "server-only";
import { db } from "@/server/db";
import { continueLearning, nextLessonFor, studentStats } from "./learning";
import { currentStreak, levelFromXp } from "./gamification";
import { studentAssignments } from "./assessments";

/** Dados da home do aluno — uma única ida ao serviço, consultas em paralelo. */
export async function studentHome(userId: string) {
  const now = new Date();
  const [continuing, stats, streak, user, enrollments, achievements, owned, assignments, banner] = await Promise.all([
    continueLearning(userId, 4),
    studentStats(userId),
    currentStreak(userId),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, name: true } }),
    db.enrollment.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      orderBy: [{ lastAccessedAt: { sort: "desc", nulls: "last" } }],
      include: {
        course: {
          select: {
            id: true, slug: true, title: true, subtitle: true, coverUrl: true, level: true, durationMinutes: true, ratingAvg: true, ratingCount: true, categoryId: true,
            category: { select: { name: true, position: true } }, instructor: { select: { name: true } },
          },
        },
      },
    }),
    db.achievement.findMany({ where: { isActive: true }, orderBy: { xp: "asc" } }),
    db.userAchievement.findMany({ where: { userId }, select: { achievementId: true, awardedAt: true } }),
    studentAssignments(userId),
    db.banner.findFirst({
      where: {
        placement: "DASHBOARD",
        isActive: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { position: "asc" },
    }),
  ]);

  // Quizzes ainda não aprovados nos cursos ativos (próximas avaliações).
  const activeCourseIds = enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.courseId);
  const quizzes = await db.quiz.findMany({
    where: { courseId: { in: activeCourseIds }, lesson: { isPublished: true }, attempts: { none: { userId, passed: true } } },
    select: { id: true, title: true, lessonId: true, courseId: true, course: { select: { title: true } }, timeLimitMinutes: true },
    take: 6,
  });

  const upcoming = [
    ...assignments
      .filter((a) => !a.submission || a.submission.status === "RETURNED")
      .map((a) => ({
        id: a.id,
        kind: "assignment" as const,
        title: a.title,
        course: a.course.title,
        href: a.lesson ? `/learn/${a.courseId}/${a.lesson.id}` : `/courses/${a.course.slug}`,
        dueAt: a.dueAt,
        returned: a.submission?.status === "RETURNED",
      })),
    ...quizzes.map((q) => ({
      id: q.id,
      kind: "quiz" as const,
      title: q.title,
      course: q.course.title,
      href: q.lessonId ? `/learn/${q.courseId}/${q.lessonId}` : "#",
      dueAt: null as Date | null,
      returned: false,
    })),
  ]
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))
    .slice(0, 5);

  // Recomendações: cursos publicados nas categorias de interesse, ainda não matriculados.
  const enrolledIds = enrollments.map((e) => e.courseId);
  const interest = [...new Set(enrollments.map((e) => e.course.categoryId).filter(Boolean))] as string[];
  const recommended = await db.course.findMany({
    where: { status: "PUBLISHED", id: { notIn: enrolledIds } },
    orderBy: [{ enrollmentCount: "desc" }],
    select: {
      id: true, slug: true, title: true, subtitle: true, coverUrl: true, level: true, durationMinutes: true, ratingAvg: true, ratingCount: true, enrollmentCount: true, categoryId: true,
      category: { select: { name: true, position: true } }, instructor: { select: { name: true } },
    },
    take: 12,
  });
  recommended.sort((a, b) => Number(interest.includes(b.categoryId ?? "")) - Number(interest.includes(a.categoryId ?? "")));

  const primary = continuing[0] ?? null;
  const primaryNext = primary ? await nextLessonFor(userId, primary.courseId) : null;
  const ownedMap = new Map(owned.map((o) => [o.achievementId, o.awardedAt]));

  return {
    firstName: user.name.split(" ")[0],
    level: levelFromXp(user.xp),
    xp: user.xp,
    streak,
    stats,
    banner,
    primary: primary ? { ...primary, nextLessonId: primaryNext } : null,
    otherContinuing: continuing.slice(1),
    enrollments,
    upcoming,
    recommended: recommended.slice(0, 3),
    achievements: achievements.map((a) => ({ ...a, awardedAt: ownedMap.get(a.id) ?? null })),
  };
}
