import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertPermission } from "@/server/auth/guards";
import { pctDelta, startOfUtcDay, type Bucket, type Period } from "@/lib/analytics-period";

/**
 * Indicadores da plataforma (Admin e Gestor).
 * Tudo é agregado no banco (count/groupBy/$queryRaw com date_trunc) — nenhuma
 * consulta por linha. As séries são completadas no servidor com zeros para os
 * intervalos sem dados, para que os gráficos não "pulem" dias.
 */

const DAY = 86_400_000;
export const STAFF_ROLES = ["teacher", "manager", "admin"] as const;

/** Aluno = tem o perfil "student" e nenhum perfil de equipe. */
export const studentWhere: Prisma.UserWhereInput = {
  roles: { some: { role: { key: "student" } } },
  NOT: { roles: { some: { role: { key: { in: [...STAFF_ROLES] } } } } },
};
export const teacherWhere: Prisma.UserWhereInput = { roles: { some: { role: { key: "teacher" } } } };

/** Fragmento SQL equivalente a studentWhere (alias da tabela users = u). */
export const STUDENT_SQL = Prisma.sql`
  exists (select 1 from user_roles ur join roles r on r.id = ur."roleId" where ur."userId" = u.id and r.key = 'student')
  and not exists (select 1 from user_roles ur join roles r on r.id = ur."roleId" where ur."userId" = u.id and r.key in ('teacher','manager','admin'))`;

// ── Buckets (séries temporais) ────────────────────────────────────

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pad = (n: number) => String(n).padStart(2, "0");

export function bucketStart(d: Date, b: Bucket) {
  const day = startOfUtcDay(d);
  if (b === "day") return day;
  if (b === "month") return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const dow = (day.getUTCDay() + 6) % 7; // segunda = 0 (igual ao date_trunc('week') do Postgres)
  return new Date(day.getTime() - dow * DAY);
}

function nextBucket(d: Date, b: Bucket) {
  if (b === "day") return new Date(d.getTime() + DAY);
  if (b === "week") return new Date(d.getTime() + 7 * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export function bucketLabel(d: Date, b: Bucket) {
  if (b === "month") return `${MONTHS[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

export function bucketRange(from: Date, to: Date, b: Bucket) {
  const out: Date[] = [];
  for (let d = bucketStart(from, b); d < to && out.length < 800; d = nextBucket(d, b)) out.push(d);
  return out;
}

type Raw = { b: Date; [k: string]: unknown };

/** Preenche uma série a partir do resultado agrupado (chave = início do bucket). */
export function fillSeries<K extends string>(range: Date[], b: Bucket, rows: Raw[], keys: Record<K, (r: Raw) => number>) {
  const map = new Map<number, Raw>();
  for (const r of rows) map.set(bucketStart(new Date(r.b), b).getTime(), r);
  return range.map((d) => {
    const r = map.get(d.getTime());
    const row: Record<string, string | number> = { label: bucketLabel(d, b), date: d.toISOString() };
    for (const k of Object.keys(keys) as K[]) row[k] = r ? keys[k](r) : 0;
    return row;
  });
}

/** Intervalo dos gráficos: "hoje" sozinho não forma série — mostramos 14 dias de contexto. */
export function chartWindow(p: Period, earliest?: Date | null) {
  const to = p.to;
  let from = p.from;
  if (!from) from = earliest ? startOfUtcDay(earliest) : new Date(to.getTime() - 365 * DAY);
  if (p.key === "today") from = new Date(to.getTime() - 14 * DAY);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY));
  const bucket: Bucket = p.key === "all" ? (days <= 92 ? "day" : days <= 400 ? "week" : "month") : p.key === "today" ? "day" : p.bucket;
  return { from, to, bucket, expanded: p.key === "today" };
}

const n = (v: unknown) => Number(v ?? 0);
const range = (from: Date | null, to: Date) => (from ? { gte: from, lt: to } : { lt: to });

// ── KPIs ──────────────────────────────────────────────────────────

export type Kpi = { value: number; previous: number | null; delta: number | null };
const kpi = (value: number, previous: number | null): Kpi => ({ value, previous, delta: pctDelta(value, previous) });

async function activeStudents(from: Date, to: Date) {
  const [r] = await db.$queryRaw<{ c: number }[]>`
    select count(distinct a."userId")::int c from user_activity_days a join users u on u.id = a."userId"
    where a.date >= ${from}::date and a.date < ${to}::date and ${STUDENT_SQL}`;
  return n(r?.c);
}

async function studySeconds(from: Date, to: Date) {
  const r = await db.userActivityDay.aggregate({ where: { date: { gte: from, lt: to } }, _sum: { seconds: true } });
  return n(r._sum.seconds);
}

export async function getKpis(p: Period) {
  await assertPermission("analytics.view", "users.manage", "settings.manage");
  const from = p.from ?? new Date(0);
  const hasPrev = !!(p.prevFrom && p.prevTo);
  const pf = p.prevFrom ?? new Date(0);
  const pt = p.prevTo ?? new Date(0);
  const prev = <T>(fn: () => Promise<T>) => (hasPrev ? fn() : Promise.resolve(null));

  const [
    totalStudents, newStudents, newStudentsPrev, active, activePrev, teachers, managers, courses, published, inReview, lessons,
    enrollments, enrollmentsPrev, completions, completionsPrev, certificates, certificatesPrev, seconds, secondsPrev, enrollStatus,
  ] = await Promise.all([
    db.user.count({ where: studentWhere }),
    db.user.count({ where: { ...studentWhere, createdAt: range(p.from, p.to) } }),
    prev(() => db.user.count({ where: { ...studentWhere, createdAt: { gte: pf, lt: pt } } })),
    activeStudents(from, p.to),
    prev(() => activeStudents(pf, pt)),
    db.user.count({ where: teacherWhere }),
    db.user.count({ where: { roles: { some: { role: { key: "manager" } } } } }),
    db.course.count({ where: { status: { not: "ARCHIVED" } } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.course.count({ where: { status: "REVIEW" } }),
    db.lesson.count({ where: { isPublished: true, course: { status: { not: "ARCHIVED" } } } }),
    db.enrollment.count({ where: { enrolledAt: range(p.from, p.to) } }),
    prev(() => db.enrollment.count({ where: { enrolledAt: { gte: pf, lt: pt } } })),
    db.enrollment.count({ where: { completedAt: range(p.from, p.to), status: "COMPLETED" } }),
    prev(() => db.enrollment.count({ where: { completedAt: { gte: pf, lt: pt }, status: "COMPLETED" } })),
    db.certificate.count({ where: { issuedAt: range(p.from, p.to), revokedAt: null } }),
    prev(() => db.certificate.count({ where: { issuedAt: { gte: pf, lt: pt }, revokedAt: null } })),
    studySeconds(from, p.to),
    prev(() => studySeconds(pf, pt)),
    db.enrollment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(enrollStatus.map((s) => [s.status, s._count._all])) as Record<string, number>;
  const valid = (byStatus.ACTIVE ?? 0) + (byStatus.COMPLETED ?? 0);
  const hours = seconds / 3600;

  return {
    totalStudents,
    newStudents: kpi(newStudents, newStudentsPrev),
    activeStudents: kpi(active, activePrev),
    teachers,
    managers,
    courses,
    publishedCourses: published,
    coursesInReview: inReview,
    lessons,
    enrollments: kpi(enrollments, enrollmentsPrev),
    completions: kpi(completions, completionsPrev),
    certificates: kpi(certificates, certificatesPrev),
    hours: kpi(hours, secondsPrev == null ? null : secondsPrev / 3600),
    hoursPerActive: active ? hours / active : 0,
    completionRate: valid ? ((byStatus.COMPLETED ?? 0) / valid) * 100 : 0,
    activeEnrollments: byStatus.ACTIVE ?? 0,
  };
}

// ── Séries ────────────────────────────────────────────────────────

export async function getSeries(p: Period) {
  await assertPermission("analytics.view", "users.manage", "settings.manage");
  let earliest: Date | null = null;
  if (!p.from) {
    const r = await db.user.aggregate({ _min: { createdAt: true } });
    earliest = r._min.createdAt;
  }
  const w = chartWindow(p, earliest);
  const unit = w.bucket;
  const buckets = bucketRange(w.from, w.to, unit);

  const [engagement, enroll, complete, signups, base, logins] = await Promise.all([
    db.$queryRaw<Raw[]>`
      select date_trunc(${unit}, a.date::timestamp) b, sum(a.seconds)::bigint s, count(distinct a."userId")::int u,
             count(*)::int d, sum(a.lessons)::int l
      from user_activity_days a
      where a.date >= ${w.from}::date and a.date < ${w.to}::date group by 1`,
    db.$queryRaw<Raw[]>`
      select date_trunc(${unit}, "enrolledAt") b, count(*)::int c from enrollments
      where "enrolledAt" >= ${w.from} and "enrolledAt" < ${w.to} group by 1`,
    db.$queryRaw<Raw[]>`
      select date_trunc(${unit}, "completedAt") b, count(*)::int c from enrollments
      where status = 'COMPLETED' and "completedAt" >= ${w.from} and "completedAt" < ${w.to} group by 1`,
    db.$queryRaw<Raw[]>`
      select date_trunc(${unit}, u."createdAt") b, count(*)::int c from users u
      where u."createdAt" >= ${w.from} and u."createdAt" < ${w.to} and ${STUDENT_SQL} group by 1`,
    db.user.count({ where: { ...studentWhere, createdAt: { lt: w.from } } }),
    db.$queryRaw<Raw[]>`
      select date_trunc(${unit}, "createdAt") b, count(*)::int c from audit_logs
      where action = 'auth.login' and "createdAt" >= ${w.from} and "createdAt" < ${w.to} group by 1`,
  ]);

  const eng = fillSeries(buckets, unit, engagement, {
    hours: (r) => Math.round((n(r.s) / 3600) * 10) / 10,
    active: (r) => n(r.u),
    sessions: (r) => n(r.d),
    lessons: (r) => n(r.l),
  });
  const loginSeries = fillSeries(buckets, unit, logins, { logins: (r) => n(r.c) });
  let acc = base;
  const growth = fillSeries(buckets, unit, signups, { new: (r) => n(r.c) }).map((r) => {
    acc += Number(r.new);
    return { ...r, total: acc };
  });

  return {
    bucket: unit,
    expanded: w.expanded,
    engagement: eng,
    enrollments: fillSeries(buckets, unit, enroll, { enrollments: (r) => n(r.c) }),
    completions: fillSeries(buckets, unit, complete, { completions: (r) => n(r.c) }),
    growth,
    access: eng.map((r, i) => ({ label: r.label, date: r.date, sessions: r.sessions, logins: loginSeries[i]?.logins ?? 0 })),
  };
}

// ── Rankings ──────────────────────────────────────────────────────

export async function topCourses(p: Period, take = 6) {
  await assertPermission("analytics.view", "users.manage", "settings.manage");
  const from = p.key === "today" ? new Date(p.to.getTime() - DAY) : (p.from ?? new Date(0));
  const rows = await db.$queryRaw<{ id: string; title: string; users: number; seconds: bigint; lessons: number }[]>`
    select c.id, c.title, count(distinct pr."userId")::int users, coalesce(sum(pr."watchedSeconds"), 0)::bigint seconds,
           count(*) filter (where pr."completedAt" >= ${from} and pr."completedAt" < ${p.to})::int lessons
    from progress pr join courses c on c.id = pr."courseId"
    where pr."updatedAt" >= ${from} and pr."updatedAt" < ${p.to}
    group by c.id, c.title order by users desc, seconds desc limit ${take}`;
  return rows.map((r) => ({ id: r.id, title: r.title, students: n(r.users), seconds: n(r.seconds), lessonsCompleted: n(r.lessons) }));
}

/**
 * Atividade docente no período: correções, aulas criadas, comunicados e
 * respostas na comunidade. Pontuação simples (soma) só para ordenar.
 */
export async function topTeachers(p: Period, take = 6) {
  await assertPermission("analytics.view", "users.manage", "settings.manage");
  const from = p.from ?? new Date(0);
  const rows = await db.$queryRaw<{ id: string; name: string; gradings: number; lessons: number; announcements: number; replies: number }[]>`
    with t as (
      select u.id, u.name from users u
      where exists (select 1 from user_roles ur join roles r on r.id = ur."roleId" where ur."userId" = u.id and r.key = 'teacher')
    )
    select t.id, t.name,
      (select count(*) from assignment_submissions s where s."gradedById" = t.id and s."gradedAt" >= ${from} and s."gradedAt" < ${p.to})::int gradings,
      (select count(*) from lessons l join courses c on c.id = l."courseId" where c."instructorId" = t.id and l."createdAt" >= ${from} and l."createdAt" < ${p.to})::int lessons,
      (select count(*) from announcements a where a."authorId" = t.id and a."createdAt" >= ${from} and a."createdAt" < ${p.to})::int announcements,
      (select count(*) from discussion_replies d where d."authorId" = t.id and d."deletedAt" is null and d."createdAt" >= ${from} and d."createdAt" < ${p.to})::int replies
    from t`;
  return rows
    .map((r) => ({ ...r, score: n(r.gradings) + n(r.lessons) + n(r.announcements) + n(r.replies) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, take);
}

// ── Atividade recente ─────────────────────────────────────────────

export type ActivityItem = {
  id: string;
  at: Date;
  kind: "enrollment" | "completion" | "certificate" | "submission" | "signup";
  user: { id: string; name: string; avatarUrl: string | null };
  subject: string;
  href?: string;
};

export async function recentActivity(take = 10): Promise<ActivityItem[]> {
  await assertPermission("analytics.view", "users.manage", "settings.manage");
  const user = { select: { id: true, name: true, avatarUrl: true } } as const;
  const [enrollments, completions, certificates, submissions, signups] = await Promise.all([
    db.enrollment.findMany({ orderBy: { enrolledAt: "desc" }, take, select: { id: true, enrolledAt: true, user, course: { select: { title: true } } } }),
    db.enrollment.findMany({
      where: { status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take,
      select: { id: true, completedAt: true, user, course: { select: { title: true } } },
    }),
    db.certificate.findMany({ orderBy: { issuedAt: "desc" }, take, select: { id: true, issuedAt: true, code: true, courseTitle: true, user } }),
    db.assignmentSubmission.findMany({
      orderBy: { submittedAt: "desc" },
      take,
      select: { id: true, submittedAt: true, user, assignment: { select: { title: true } } },
    }),
    db.user.findMany({ where: studentWhere, orderBy: { createdAt: "desc" }, take, select: { id: true, name: true, avatarUrl: true, createdAt: true } }),
  ]);
  const items: ActivityItem[] = [
    ...enrollments.map((e) => ({ id: `e${e.id}`, at: e.enrolledAt, kind: "enrollment" as const, user: e.user, subject: e.course.title })),
    ...completions.map((e) => ({ id: `c${e.id}`, at: e.completedAt!, kind: "completion" as const, user: e.user, subject: e.course.title })),
    ...certificates.map((c) => ({ id: `k${c.id}`, at: c.issuedAt, kind: "certificate" as const, user: c.user, subject: c.courseTitle, href: `/certificate/${c.code}` })),
    ...submissions.map((s) => ({ id: `s${s.id}`, at: s.submittedAt, kind: "submission" as const, user: s.user, subject: s.assignment.title })),
    ...signups.map((u) => ({ id: `u${u.id}`, at: u.createdAt, kind: "signup" as const, user: { id: u.id, name: u.name, avatarUrl: u.avatarUrl }, subject: "Criou a conta" })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}

// ── Operação (painel do administrador) ────────────────────────────

export async function adminAlerts() {
  await assertPermission("users.manage", "settings.manage");
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const [review, pendingSubmissions, oldestPending, failedEmails, blocked, totalUsers] = await Promise.all([
    db.course.findMany({
      where: { status: "REVIEW" },
      orderBy: { updatedAt: "asc" },
      take: 3,
      select: { id: true, title: true, updatedAt: true, instructor: { select: { name: true } } },
    }),
    db.assignmentSubmission.count({ where: { status: { in: ["SUBMITTED", "GRADING"] } } }),
    db.assignmentSubmission.findFirst({ where: { status: { in: ["SUBMITTED", "GRADING"] } }, orderBy: { submittedAt: "asc" }, select: { submittedAt: true } }),
    db.emailMessage.count({ where: { status: "FAILED", createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { status: "BLOCKED" } }),
    db.user.count(),
  ]);
  const reviewCount = review.length < 3 ? review.length : await db.course.count({ where: { status: "REVIEW" } });
  return { review, reviewCount, pendingSubmissions, oldestPendingAt: oldestPending?.submittedAt ?? null, failedEmails, blocked, totalUsers };
}
