import "server-only";
import type { CourseStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { managedCourseScope } from "./course-builder";
import { gradingCourseScope } from "./grading";

/**
 * Consultas (somente leitura) da área do professor: painel, lista de cursos e
 * alunos. Tudo é restrito ao escopo de cursos que o usuário gerencia.
 */

const DAY = 86_400_000;

function utcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function teacherDashboard(user: SessionUser) {
  const scope = managedCourseScope(user);
  const courses = await db.course.findMany({
    where: scope,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, title: true, status: true, slug: true, ratingAvg: true, ratingCount: true, updatedAt: true,
      _count: { select: { lessons: { where: { isPublished: true } } } },
    },
  });
  const courseIds = courses.map((c) => c.id);
  const inCourses = { courseId: { in: courseIds } };
  const since = utcDay(new Date(Date.now() - 29 * DAY));
  const gscope = gradingCourseScope(user);

  const [enrollByCourse, completedByCourse, students, watched, attempts, pendingSubs, pendingAttempts, openQuestions, completions, attention, reviewCourses] =
    await Promise.all([
      db.enrollment.groupBy({ by: ["courseId"], where: { ...inCourses, status: { not: "CANCELLED" } }, _count: true, _avg: { progressPercent: true } }),
      db.enrollment.groupBy({ by: ["courseId"], where: { ...inCourses, status: "COMPLETED" }, _count: true }),
      db.enrollment.findMany({ where: { ...inCourses, status: { not: "CANCELLED" } }, distinct: ["userId"], select: { userId: true } }),
      db.lessonProgress.aggregate({ where: inCourses, _sum: { watchedSeconds: true } }),
      db.quizAttempt.findMany({
        where: { status: "GRADED", quiz: inCourses },
        select: { score: true, passed: true, quiz: { select: { id: true, title: true, course: { select: { title: true } } } } },
      }),
      db.assignmentSubmission.count({ where: { status: { in: ["SUBMITTED", "GRADING"] }, assignment: { course: gscope } } }),
      db.quizAttempt.count({ where: { status: "PENDING_REVIEW", quiz: { course: gscope } } }),
      db.discussionThread.count({ where: { ...inCourses, type: "QUESTION", solutionReplyId: null, deletedAt: null } }),
      db.lessonProgress.findMany({ where: { ...inCourses, status: "COMPLETED", completedAt: { gte: since } }, select: { completedAt: true, userId: true } }),
      db.assignmentSubmission.findMany({
        where: { status: { in: ["SUBMITTED", "GRADING"] }, assignment: { course: gscope } },
        orderBy: { submittedAt: "asc" },
        take: 5,
        select: { id: true, submittedAt: true, user: { select: { name: true, avatarUrl: true } }, assignment: { select: { title: true, course: { select: { title: true } } } } },
      }),
      db.course.findMany({ where: { ...scope, status: "REVIEW" }, select: { id: true, title: true, updatedAt: true }, take: 5 }),
    ]);

  const studentIds = students.map((s) => s.userId);
  const activity = studentIds.length
    ? await db.userActivityDay.findMany({ where: { userId: { in: studentIds }, date: { gte: since } }, select: { date: true, userId: true, seconds: true } })
    : [];

  // Série diária (30 dias): alunos ativos e aulas concluídas nos cursos do professor.
  const days = new Map<string, { active: Set<string>; lessons: number }>();
  for (let i = 0; i < 30; i++) days.set(new Date(since.getTime() + i * DAY).toISOString().slice(0, 10), { active: new Set(), lessons: 0 });
  for (const a of activity) days.get(a.date.toISOString().slice(0, 10))?.active.add(a.userId);
  for (const c of completions) {
    const d = c.completedAt && days.get(utcDay(c.completedAt).toISOString().slice(0, 10));
    if (d) d.lessons++;
  }
  const daily = [...days.entries()].map(([iso, v]) => ({
    dia: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
    ativos: v.active.size,
    aulas: v.lessons,
  }));

  const enrollMap = new Map(enrollByCourse.map((e) => [e.courseId, e]));
  const completedMap = new Map(completedByCourse.map((e) => [e.courseId, e._count]));
  const perCourse = courses
    .filter((c) => c.status === "PUBLISHED" || enrollMap.has(c.id))
    .map((c) => {
      const e = enrollMap.get(c.id);
      const total = e?._count ?? 0;
      return {
        id: c.id,
        title: c.title,
        students: total,
        avgProgress: Math.round(e?._avg.progressPercent ?? 0),
        completion: total ? Math.round(((completedMap.get(c.id) ?? 0) / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.students - a.students);

  const totalEnroll = enrollByCourse.reduce((n, e) => n + e._count, 0);
  const totalCompleted = completedByCourse.reduce((n, e) => n + e._count, 0);
  const rated = courses.filter((c) => c.ratingCount > 0);
  const ratingCount = rated.reduce((n, c) => n + c.ratingCount, 0);
  const ratingAvg = ratingCount ? rated.reduce((n, c) => n + c.ratingAvg * c.ratingCount, 0) / ratingCount : 0;

  const quizMap = new Map<string, { label: string; course: string; sum: number; n: number; passed: number }>();
  for (const a of attempts) {
    const q = quizMap.get(a.quiz.id) ?? { label: a.quiz.title, course: a.quiz.course.title, sum: 0, n: 0, passed: 0 };
    q.sum += a.score ?? 0;
    q.n++;
    if (a.passed) q.passed++;
    quizMap.set(a.quiz.id, q);
  }
  const quizPerf = [...quizMap.values()]
    .map((q) => ({ label: q.label, course: q.course, avg: Math.round(q.sum / q.n), passRate: Math.round((q.passed / q.n) * 100), attempts: q.n }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 6);
  const quizAvg = attempts.length ? attempts.reduce((n, a) => n + (a.score ?? 0), 0) / attempts.length : null;

  const count = (s: CourseStatus[]) => courses.filter((c) => s.includes(c.status)).length;
  return {
    kpis: {
      published: count(["PUBLISHED"]),
      drafts: count(["DRAFT"]),
      inReview: count(["REVIEW"]),
      students: studentIds.length,
      lessons: courses.reduce((n, c) => n + c._count.lessons, 0),
      completionRate: totalEnroll ? Math.round((totalCompleted / totalEnroll) * 100) : 0,
      hoursWatched: (watched._sum.watchedSeconds ?? 0) / 3600,
      ratingAvg,
      ratingCount,
      quizAvg,
      pendingGrading: pendingSubs + pendingAttempts,
      openQuestions,
      activeLast7: new Set(activity.filter((a) => a.date.getTime() >= utcDay(new Date(Date.now() - 6 * DAY)).getTime()).map((a) => a.userId)).size,
    },
    daily,
    perCourse,
    quizPerf,
    attention: { submissions: attention, pendingAttempts, reviewCourses, drafts: courses.filter((c) => c.status === "DRAFT").slice(0, 3) },
    courses: courses.map((c) => ({ id: c.id, title: c.title, status: c.status })),
  };
}

export type CourseListFilter = { status?: CourseStatus; q?: string };

export async function teacherCourses(user: SessionUser, filter: CourseListFilter = {}) {
  const scope = managedCourseScope(user);
  const where: Prisma.CourseWhereInput = {
    ...scope,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.q ? { title: { contains: filter.q, mode: "insensitive" } } : {}),
  };
  const [courses, byStatus] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, subtitle: true, slug: true, status: true, coverUrl: true, updatedAt: true, durationMinutes: true,
        category: { select: { name: true } },
        instructor: { select: { name: true } },
        instructorId: true,
        _count: { select: { lessons: true, modules: true } },
      },
    }),
    db.course.groupBy({ by: ["status"], where: scope, _count: true }),
  ]);
  const stats = await db.enrollment.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courses.map((c) => c.id) }, status: { not: "CANCELLED" } },
    _count: true,
    _avg: { progressPercent: true },
  });
  const sm = new Map(stats.map((s) => [s.courseId, s]));
  const counts = Object.fromEntries(byStatus.map((b) => [b.status, b._count])) as Partial<Record<CourseStatus, number>>;
  return {
    courses: courses.map((c) => ({ ...c, students: sm.get(c.id)?._count ?? 0, avgProgress: Math.round(sm.get(c.id)?._avg.progressPercent ?? 0) })),
    counts,
    total: byStatus.reduce((n, b) => n + b._count, 0),
  };
}

/** Cursos com módulos (para os atalhos de "Nova aula"/"Nova atividade" e filtros). */
export async function teacherCourseOptions(user: SessionUser) {
  return db.course.findMany({
    where: { ...managedCourseScope(user), status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, status: true, modules: { orderBy: { position: "asc" }, select: { id: true, title: true } } },
  });
}

export async function teacherStudents(user: SessionUser, filter: { q?: string; courseId?: string; page?: number; pageSize?: number } = {}) {
  const courseWhere: Prisma.CourseWhereInput = { ...managedCourseScope(user), ...(filter.courseId ? { id: filter.courseId } : {}) };
  const enrollments = await db.enrollment.findMany({
    where: {
      status: { not: "CANCELLED" },
      course: courseWhere,
      ...(filter.q
        ? { user: { OR: [{ name: { contains: filter.q, mode: "insensitive" } }, { email: { contains: filter.q, mode: "insensitive" } }] } }
        : {}),
    },
    select: {
      status: true, progressPercent: true, lastAccessedAt: true, enrolledAt: true,
      course: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true, avatarUrl: true, lastSeenAt: true } },
    },
  });
  type Row = {
    user: (typeof enrollments)[number]["user"];
    courses: { id: string; title: string; progress: number; status: string }[];
    avgProgress: number;
    lastAccess: Date | null;
    completed: number;
  };
  const map = new Map<string, Row>();
  for (const e of enrollments) {
    const r = map.get(e.user.id) ?? { user: e.user, courses: [], avgProgress: 0, lastAccess: null, completed: 0 };
    r.courses.push({ id: e.course.id, title: e.course.title, progress: e.progressPercent, status: e.status });
    if (e.status === "COMPLETED") r.completed++;
    const la = e.lastAccessedAt ?? null;
    if (la && (!r.lastAccess || la > r.lastAccess)) r.lastAccess = la;
    map.set(e.user.id, r);
  }
  const rows = [...map.values()].map((r) => ({ ...r, avgProgress: Math.round(r.courses.reduce((n, c) => n + c.progress, 0) / r.courses.length) }));
  rows.sort((a, b) => (b.lastAccess?.getTime() ?? 0) - (a.lastAccess?.getTime() ?? 0) || a.user.name.localeCompare(b.user.name));
  const pageSize = filter.pageSize ?? 20;
  const page = filter.page ?? 1;
  const inactive = rows.filter((r) => !r.lastAccess || r.lastAccess.getTime() < Date.now() - 14 * DAY).length;
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, inactive, pageSize, page };
}

/** Matriculados de um curso (aba Alunos do builder). */
export async function courseStudents(courseId: string) {
  return db.enrollment.findMany({
    where: { courseId, status: { not: "CANCELLED" } },
    orderBy: [{ lastAccessedAt: { sort: "desc", nulls: "last" } }, { enrolledAt: "desc" }],
    select: {
      id: true, status: true, progressPercent: true, lastAccessedAt: true, enrolledAt: true, completedAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      lastLesson: { select: { title: true } },
    },
  });
}

/** Avaliações do curso (aba Avaliações do builder). */
export async function courseAssessments(courseId: string) {
  const [quizzes, assignments] = await Promise.all([
    db.quiz.findMany({
      where: { courseId },
      select: {
        id: true, title: true, passingScore: true, maxAttempts: true, lessonId: true,
        lesson: { select: { id: true, isPublished: true, module: { select: { title: true } } } },
        _count: { select: { questions: true } },
        attempts: { where: { status: { not: "IN_PROGRESS" } }, select: { score: true, passed: true, status: true } },
      },
    }),
    db.assignment.findMany({
      where: { courseId },
      select: {
        id: true, title: true, dueAt: true, maxScore: true, lessonId: true,
        lesson: { select: { id: true, isPublished: true, module: { select: { title: true } } } },
        submissions: { select: { status: true, score: true } },
      },
    }),
  ]);
  return {
    quizzes: quizzes.map((q) => {
      const graded = q.attempts.filter((a) => a.status === "GRADED");
      return {
        ...q,
        attemptsCount: q.attempts.length,
        pending: q.attempts.filter((a) => a.status === "PENDING_REVIEW").length,
        avg: graded.length ? Math.round(graded.reduce((n, a) => n + (a.score ?? 0), 0) / graded.length) : null,
        passRate: graded.length ? Math.round((graded.filter((a) => a.passed).length / graded.length) * 100) : null,
      };
    }),
    assignments: assignments.map((a) => {
      const graded = a.submissions.filter((s) => s.score != null);
      return {
        ...a,
        total: a.submissions.length,
        pending: a.submissions.filter((s) => s.status === "SUBMITTED" || s.status === "GRADING").length,
        approved: a.submissions.filter((s) => s.status === "APPROVED").length,
        avg: graded.length ? graded.reduce((n, s) => n + (s.score ?? 0), 0) / graded.length : null,
      };
    }),
  };
}
