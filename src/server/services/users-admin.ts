import "server-only";
import { Prisma, type UserStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertPermission } from "@/server/auth/guards";
import { revokeAllSessions, type SessionUser } from "@/server/auth/session";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";
import { sendPasswordLink } from "@/server/services/auth";
import { cancelEnrollment, createEnrollment } from "@/server/services/learning";
import { levelFromXp } from "@/server/services/gamification";
import { studentWhere, teacherWhere } from "@/server/services/analytics";
import { ROLE_KEYS, type RoleKey } from "@/lib/permissions";

/**
 * Gestão de pessoas (Admin/Gestor): contas, alunos e professores.
 * Leitura: users.view | students.view_all. Escrita: users.manage / enrollments.manage.
 * Nunca selecionamos passwordHash — todas as consultas usam `select` explícito.
 */

const DAY = 86_400_000;
export const PAGE_SIZE = 20;

type Dir = "asc" | "desc";
const dirOf = (d?: string): Dir => (d === "asc" ? "asc" : "desc");

export const JOINED_OPTIONS = [
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "90d", label: "Últimos 90 dias", days: 90 },
  { value: "365d", label: "Último ano", days: 365 },
] as const;

function joinedWhere(joined?: string): Prisma.UserWhereInput {
  const opt = JOINED_OPTIONS.find((o) => o.value === joined);
  return opt ? { createdAt: { gte: new Date(Date.now() - opt.days * DAY) } } : {};
}

function searchWhere(q?: string): Prisma.UserWhereInput {
  const term = q?.trim();
  if (!term) return {};
  return { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] };
}

const STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE", "BLOCKED"];
const statusWhere = (s?: string): Prisma.UserWhereInput => (STATUSES.includes(s as UserStatus) ? { status: s as UserStatus } : {});

const userListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  headline: true,
  avatarUrl: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  lastSeenAt: true,
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserSelect;

const rolesOf = (u: { roles: { role: { key: string } }[] }) => u.roles.map((r) => r.role.key as RoleKey).filter((k) => ROLE_KEYS.includes(k));

// ── Contas ────────────────────────────────────────────────────────

export type UserListParams = { q?: string; role?: string; status?: string; joined?: string; sort?: string; dir?: string; page?: number };

export async function listUsers(params: UserListParams) {
  await assertPermission("users.view", "users.manage");
  const where: Prisma.UserWhereInput = {
    AND: [
      searchWhere(params.q),
      statusWhere(params.status),
      joinedWhere(params.joined),
      ROLE_KEYS.includes(params.role as RoleKey) ? { roles: { some: { role: { key: params.role } } } } : {},
    ],
  };
  const sortable = { name: "name", email: "email", createdAt: "createdAt", lastSeenAt: "lastSeenAt" } as const;
  const field = sortable[params.sort as keyof typeof sortable] ?? "createdAt";
  const dir = params.sort ? dirOf(params.dir) : "desc";
  const page = Math.max(1, params.page ?? 1);
  const [rows, total, byStatus] = await Promise.all([
    db.user.findMany({
      where,
      select: userListSelect,
      orderBy: field === "lastSeenAt" ? [{ lastSeenAt: { sort: dir, nulls: "last" } }, { id: "asc" }] : [{ [field]: dir }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
    db.user.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    rows: rows.map((u) => ({ ...u, roles: rolesOf(u) })),
    total,
    page,
    statusCounts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Partial<Record<UserStatus, number>>,
  };
}
export type UserRow = Awaited<ReturnType<typeof listUsers>>["rows"][number];

export const userInputSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  headline: z.string().trim().max(120).optional().or(z.literal("")),
  roles: z.array(z.enum(ROLE_KEYS)).min(1, "Escolha ao menos um perfil"),
});
export const createUserSchema = userInputSchema.extend({ sendInvite: z.boolean().default(true) });
export const updateUserSchema = userInputSchema.extend({ id: z.string().min(1), status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]) });

async function roleIds(keys: RoleKey[]) {
  const roles = await db.role.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
  return roles.map((r) => r.id);
}

/** Conceder/remover o perfil de administrador exige roles.manage. */
function assertRoleChangeAllowed(actor: SessionUser, before: RoleKey[], after: RoleKey[]) {
  const touchesAdmin = before.includes("admin") !== after.includes("admin");
  if (touchesAdmin && !actor.permissions.has("roles.manage")) throw new ForbiddenError("Somente quem gerencia permissões pode alterar o perfil de administrador.");
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const actor = await assertPermission("users.manage");
  assertRoleChangeAllowed(actor, [], input.roles);
  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new ValidationError(undefined, { email: "Já existe uma conta com este e-mail." });
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      headline: input.headline || null,
      roles: { create: (await roleIds(input.roles)).map((roleId) => ({ roleId })) },
    },
    select: { id: true, name: true, email: true },
  });
  let invited = false;
  if (input.sendInvite) {
    try {
      await sendPasswordLink(user, "invite");
      invited = true;
    } catch (error) {
      logger.error("users.invite_failed", { error, category: "infra" });
    }
  }
  await audit("user.created", { actorId: actor.id, entityType: "user", entityId: user.id, metadata: { roles: input.roles, invited } });
  return { id: user.id, invited };
}

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  const actor = await assertPermission("users.manage");
  const before = await db.user.findUnique({ where: { id: input.id }, select: userListSelect });
  if (!before) throw new NotFoundError("Usuário não encontrado.");
  const beforeRoles = rolesOf(before);
  assertRoleChangeAllowed(actor, beforeRoles, input.roles);
  if (input.id === actor.id) {
    if (input.status !== "ACTIVE") throw new AppError("Você não pode bloquear ou inativar a própria conta.", "SELF_STATUS", 400);
    if (beforeRoles.includes("admin") && !input.roles.includes("admin")) throw new AppError("Você não pode remover o próprio perfil de administrador.", "SELF_ROLE", 400);
  }
  if (input.email !== before.email) {
    const clash = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (clash) throw new ValidationError(undefined, { email: "Já existe uma conta com este e-mail." });
  }
  const ids = await roleIds(input.roles);
  await db.$transaction([
    db.user.update({
      where: { id: input.id },
      data: { name: input.name, email: input.email, phone: input.phone || null, headline: input.headline || null, status: input.status },
    }),
    db.userRole.deleteMany({ where: { userId: input.id, roleId: { notIn: ids } } }),
    db.userRole.createMany({ data: ids.map((roleId) => ({ userId: input.id, roleId })), skipDuplicates: true }),
  ]);
  if (input.status !== "ACTIVE" && before.status === "ACTIVE") await revokeAllSessions(input.id);
  const changes: Record<string, Prisma.InputJsonValue> = {};
  if (before.name !== input.name) changes.name = input.name;
  if (before.email !== input.email) changes.email = { from: before.email, to: input.email };
  if (before.status !== input.status) changes.status = { from: before.status, to: input.status };
  if (beforeRoles.sort().join() !== [...input.roles].sort().join()) changes.roles = { from: beforeRoles, to: input.roles };
  await audit("user.updated", { actorId: actor.id, entityType: "user", entityId: input.id, metadata: changes });
}

const STATUS_AUDIT: Record<UserStatus, string> = { ACTIVE: "user.activated", INACTIVE: "user.deactivated", BLOCKED: "user.blocked" };

/** Ativar / inativar / bloquear (em massa). Bloqueio e inativação encerram as sessões. */
export async function setUsersStatus(ids: string[], status: UserStatus) {
  const actor = await assertPermission("users.manage");
  const targets = await db.user.findMany({ where: { id: { in: ids }, NOT: { id: actor.id }, status: { not: status } }, select: { id: true, status: true } });
  if (ids.includes(actor.id) && status !== "ACTIVE") {
    if (!targets.length) throw new AppError("Você não pode bloquear ou inativar a própria conta.", "SELF_STATUS", 400);
  }
  if (!targets.length) return { changed: 0 };
  await db.user.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { status } });
  if (status !== "ACTIVE") await Promise.all(targets.map((t) => revokeAllSessions(t.id)));
  await Promise.all(
    targets.map((t) => audit(STATUS_AUDIT[status], { actorId: actor.id, entityType: "user", entityId: t.id, metadata: { from: t.status, to: status, bulk: ids.length > 1 } })),
  );
  return { changed: targets.length };
}

export async function sendResetLink(id: string) {
  const actor = await assertPermission("users.manage");
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, status: true } });
  if (!user) throw new NotFoundError("Usuário não encontrado.");
  if (user.status === "BLOCKED") throw new AppError("Desbloqueie a conta antes de enviar um link de senha.", "BLOCKED", 400);
  await sendPasswordLink(user, "reset");
  await audit("user.password_reset_sent", { actorId: actor.id, entityType: "user", entityId: user.id });
  return { email: user.email };
}

// ── Métricas por aluno / professor (em lote, sem N+1) ─────────────

export async function studentMetrics(ids: string[]) {
  const out = new Map<string, { courses: number; completed: number; avgProgress: number; seconds: number; lastActivity: Date | null }>();
  if (!ids.length) return out;
  const [byStatus, avg, activity] = await Promise.all([
    db.enrollment.groupBy({ by: ["userId", "status"], where: { userId: { in: ids }, status: { not: "CANCELLED" } }, _count: { _all: true } }),
    db.enrollment.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: { not: "CANCELLED" } }, _avg: { progressPercent: true } }),
    db.userActivityDay.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _sum: { seconds: true }, _max: { date: true } }),
  ]);
  for (const id of ids) out.set(id, { courses: 0, completed: 0, avgProgress: 0, seconds: 0, lastActivity: null });
  for (const r of byStatus) {
    const m = out.get(r.userId)!;
    m.courses += r._count._all;
    if (r.status === "COMPLETED") m.completed += r._count._all;
  }
  for (const r of avg) out.get(r.userId)!.avgProgress = Math.round(r._avg.progressPercent ?? 0);
  for (const r of activity) {
    const m = out.get(r.userId)!;
    m.seconds = r._sum.seconds ?? 0;
    m.lastActivity = r._max.date;
  }
  return out;
}

export type TeacherMetric = {
  courses: number;
  published: number;
  students: number;
  completed: number;
  completionRate: number;
  avgProgress: number;
  avgQuizScore: number | null;
  rating: number | null;
  gradings: number;
  pending: number;
};

export async function teacherMetrics(ids: string[], range?: { from: Date | null; to: Date }) {
  const out = new Map<string, TeacherMetric>();
  if (!ids.length) return out;
  const idList = Prisma.join(ids);
  const from = range?.from ?? new Date(0);
  const to = range?.to ?? new Date(Date.now() + DAY);
  const [courses, enroll, quiz, pending, gradings] = await Promise.all([
    db.course.groupBy({ by: ["instructorId", "status"], where: { instructorId: { in: ids }, status: { not: "ARCHIVED" } }, _count: { _all: true } }),
    db.$queryRaw<{ id: string; students: number; completed: number; avg: number | null; rating: number | null }[]>`
      select c."instructorId" id,
        count(e.id) filter (where e.status <> 'CANCELLED')::int students,
        count(e.id) filter (where e.status = 'COMPLETED')::int completed,
        avg(e."progressPercent") filter (where e.status <> 'CANCELLED')::float avg,
        (select sum(c2."ratingAvg" * c2."ratingCount") / nullif(sum(c2."ratingCount"), 0) from courses c2 where c2."instructorId" = c."instructorId")::float rating
      from courses c left join enrollments e on e."courseId" = c.id
      where c."instructorId" in (${idList}) group by c."instructorId"`,
    db.$queryRaw<{ id: string; avg: number | null }[]>`
      select c."instructorId" id, avg(qa.score)::float avg from quiz_attempts qa
      join quizzes q on q.id = qa."quizId" join courses c on c.id = q."courseId"
      where qa.status = 'GRADED' and c."instructorId" in (${idList}) group by 1`,
    db.$queryRaw<{ id: string; c: number }[]>`
      select c."instructorId" id, count(*)::int c from assignment_submissions s
      join assignments a on a.id = s."assignmentId" join courses c on c.id = a."courseId"
      where s.status in ('SUBMITTED','GRADING') and c."instructorId" in (${idList}) group by 1`,
    db.assignmentSubmission.groupBy({ by: ["gradedById"], where: { gradedById: { in: ids }, gradedAt: { gte: from, lt: to } }, _count: { _all: true } }),
  ]);
  for (const id of ids) out.set(id, { courses: 0, published: 0, students: 0, completed: 0, completionRate: 0, avgProgress: 0, avgQuizScore: null, rating: null, gradings: 0, pending: 0 });
  for (const r of courses) {
    const m = out.get(r.instructorId)!;
    m.courses += r._count._all;
    if (r.status === "PUBLISHED") m.published += r._count._all;
  }
  for (const r of enroll) {
    const m = out.get(r.id);
    if (!m) continue;
    m.students = Number(r.students);
    m.completed = Number(r.completed);
    m.completionRate = m.students ? (m.completed / m.students) * 100 : 0;
    m.avgProgress = Math.round(Number(r.avg ?? 0));
    m.rating = r.rating == null ? null : Number(r.rating);
  }
  for (const r of quiz) if (out.has(r.id)) out.get(r.id)!.avgQuizScore = r.avg == null ? null : Number(r.avg);
  for (const r of pending) if (out.has(r.id)) out.get(r.id)!.pending = Number(r.c);
  for (const r of gradings) if (r.gradedById && out.has(r.gradedById)) out.get(r.gradedById)!.gradings = r._count._all;
  return out;
}

// ── Alunos ────────────────────────────────────────────────────────

export const PROGRESS_BANDS = [
  { value: "0-25", label: "0–25%", min: 0, max: 25 },
  { value: "25-50", label: "25–50%", min: 25, max: 50 },
  { value: "50-75", label: "50–75%", min: 50, max: 75 },
  { value: "75-100", label: "75–100%", min: 75, max: 100.01 },
] as const;

export type StudentListParams = UserListParams & { course?: string; progress?: string };

export async function listStudents(params: StudentListParams) {
  await assertPermission("students.view_all", "users.view");
  const band = PROGRESS_BANDS.find((b) => b.value === params.progress);
  let idFilter: Prisma.UserWhereInput = {};
  if (band) {
    const rows = await db.$queryRaw<{ id: string }[]>`
      select "userId" id from enrollments where status <> 'CANCELLED'
      ${params.course ? Prisma.sql`and "courseId" = ${params.course}` : Prisma.empty}
      group by 1 having avg("progressPercent") >= ${band.min} and avg("progressPercent") < ${band.max}`;
    idFilter = { id: { in: rows.map((r) => r.id) } };
  }
  const where: Prisma.UserWhereInput = {
    AND: [
      studentWhere,
      searchWhere(params.q),
      statusWhere(params.status),
      joinedWhere(params.joined),
      params.course ? { enrollments: { some: { courseId: params.course, status: { not: "CANCELLED" } } } } : {},
      idFilter,
    ],
  };
  const sortable = { name: "name", email: "email", createdAt: "createdAt", lastSeenAt: "lastSeenAt" } as const;
  const field = sortable[params.sort as keyof typeof sortable] ?? "createdAt";
  const dir = params.sort ? dirOf(params.dir) : "desc";
  const page = Math.max(1, params.page ?? 1);
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      select: userListSelect,
      orderBy: field === "lastSeenAt" ? [{ lastSeenAt: { sort: dir, nulls: "last" } }, { id: "asc" }] : [{ [field]: dir }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);
  const metrics = await studentMetrics(rows.map((r) => r.id));
  return {
    rows: rows.map((u) => {
      const m = metrics.get(u.id)!;
      const last = [u.lastSeenAt, m.lastActivity].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
      return { ...u, roles: rolesOf(u), ...m, lastAccess: last };
    }),
    total,
    page,
  };
}
export type StudentRow = Awaited<ReturnType<typeof listStudents>>["rows"][number];

export async function courseOptions() {
  await assertPermission("students.view_all", "users.view", "analytics.view");
  return db.course.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { title: "asc" }, select: { id: true, title: true, status: true } });
}

export async function getStudentDetail(id: string) {
  await assertPermission("students.view_all", "users.view");
  const user = await db.user.findUnique({
    where: { id },
    select: { ...userListSelect, bio: true, xp: true, updatedAt: true },
  });
  if (!user) return null;
  const since = new Date(Date.now() - 90 * DAY);
  const [enrollments, submissions, attempts, certificates, achievements, logs, activity, totals] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: id },
      orderBy: [{ status: "asc" }, { enrolledAt: "desc" }],
      select: {
        id: true, status: true, source: true, progressPercent: true, enrolledAt: true, completedAt: true, lastAccessedAt: true,
        course: { select: { id: true, title: true, slug: true, instructor: { select: { name: true } }, _count: { select: { lessons: { where: { isPublished: true } } } } } },
        lastLesson: { select: { title: true } },
      },
    }),
    db.assignmentSubmission.findMany({
      where: { userId: id },
      orderBy: { submittedAt: "desc" },
      take: 50,
      select: { id: true, status: true, score: true, submittedAt: true, gradedAt: true, assignment: { select: { title: true, maxScore: true, course: { select: { title: true } } } } },
    }),
    db.quizAttempt.findMany({
      where: { userId: id },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: { id: true, attemptNumber: true, status: true, score: true, passed: true, startedAt: true, submittedAt: true, quiz: { select: { title: true, passingScore: true, course: { select: { title: true } } } } },
    }),
    db.certificate.findMany({ where: { userId: id }, orderBy: { issuedAt: "desc" }, select: { id: true, code: true, courseTitle: true, workloadHours: true, issuedAt: true, revokedAt: true } }),
    db.userAchievement.findMany({ where: { userId: id }, orderBy: { awardedAt: "desc" }, select: { awardedAt: true, achievement: { select: { name: true, description: true, xp: true } } } }),
    db.auditLog.findMany({
      where: { OR: [{ actorId: id }, { entityType: "user", entityId: id }] },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, action: true, createdAt: true, ip: true, actor: { select: { id: true, name: true } } },
    }),
    db.userActivityDay.findMany({ where: { userId: id, date: { gte: since } }, orderBy: { date: "asc" }, select: { date: true, seconds: true, lessons: true } }),
    db.userActivityDay.aggregate({ where: { userId: id }, _sum: { seconds: true, lessons: true }, _max: { date: true }, _count: { _all: true } }),
  ]);
  const active = enrollments.filter((e) => e.status !== "CANCELLED");
  return {
    user: { ...user, roles: rolesOf(user) },
    level: levelFromXp(user.xp),
    enrollments,
    submissions,
    attempts,
    certificates,
    achievements,
    logs,
    activity,
    stats: {
      courses: active.length,
      completed: active.filter((e) => e.status === "COMPLETED").length,
      avgProgress: active.length ? Math.round(active.reduce((s, e) => s + e.progressPercent, 0) / active.length) : 0,
      seconds: totals._sum.seconds ?? 0,
      lessons: totals._sum.lessons ?? 0,
      studyDays: totals._count._all,
      lastActivity: totals._max.date,
    },
  };
}

// ── Matrículas feitas pela secretaria ─────────────────────────────

export async function enrollStudent(userId: string, courseId: string) {
  const actor = await assertPermission("enrollments.manage");
  const [user, course, existing] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, status: true } }),
    db.course.findUnique({ where: { id: courseId }, select: { id: true, status: true, title: true } }),
    db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { status: true } }),
  ]);
  if (!user) throw new NotFoundError("Aluno não encontrado.");
  if (!course || course.status === "ARCHIVED") throw new NotFoundError("Curso indisponível para matrícula.");
  if (existing && existing.status !== "CANCELLED") throw new AppError("Este aluno já está matriculado neste curso.", "ALREADY_ENROLLED", 409);
  const e = await createEnrollment(userId, courseId, "ADMIN", actor.id);
  return { id: e.id, course: course.title };
}

export async function removeEnrollment(enrollmentId: string) {
  const actor = await assertPermission("enrollments.manage");
  const e = await db.enrollment.findUnique({ where: { id: enrollmentId }, select: { status: true } });
  if (!e) throw new NotFoundError("Matrícula não encontrada.");
  if (e.status === "CANCELLED") throw new AppError("Esta matrícula já foi removida.", "ALREADY_CANCELLED", 409);
  await cancelEnrollment(enrollmentId, actor.id);
}

// ── Professores ───────────────────────────────────────────────────

export async function listTeachers(params: UserListParams) {
  await assertPermission("users.view", "students.view_all");
  const where: Prisma.UserWhereInput = { AND: [teacherWhere, searchWhere(params.q), statusWhere(params.status), joinedWhere(params.joined)] };
  const sortable = { name: "name", createdAt: "createdAt", lastSeenAt: "lastSeenAt" } as const;
  const field = sortable[params.sort as keyof typeof sortable] ?? "name";
  const dir = params.sort ? dirOf(params.dir) : "asc";
  const page = Math.max(1, params.page ?? 1);
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      select: userListSelect,
      orderBy: field === "lastSeenAt" ? [{ lastSeenAt: { sort: dir, nulls: "last" } }, { id: "asc" }] : [{ [field]: dir }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);
  const metrics = await teacherMetrics(rows.map((r) => r.id));
  return { rows: rows.map((u) => ({ ...u, roles: rolesOf(u), ...metrics.get(u.id)! })), total, page };
}
export type TeacherRow = Awaited<ReturnType<typeof listTeachers>>["rows"][number];

export async function getTeacherDetail(id: string) {
  await assertPermission("users.view", "students.view_all");
  const user = await db.user.findFirst({ where: { id, ...teacherWhere }, select: { ...userListSelect, bio: true } });
  if (!user) return null;
  const courses = await db.course.findMany({
    where: { instructorId: id },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    select: {
      id: true, title: true, slug: true, status: true, ratingAvg: true, ratingCount: true, publishedAt: true,
      _count: { select: { lessons: { where: { isPublished: true } } } },
    },
  });
  const courseIds = courses.map((c) => c.id);
  const inCourses = { courseId: { in: courseIds } };
  const [metrics, byCourse, avgByCourse, quizByCourse, students, submissions, attempts] = await Promise.all([
    teacherMetrics([id]),
    db.enrollment.groupBy({ by: ["courseId", "status"], where: inCourses, _count: { _all: true } }),
    db.enrollment.groupBy({ by: ["courseId"], where: { ...inCourses, status: { not: "CANCELLED" } }, _avg: { progressPercent: true } }),
    courseIds.length
      ? db.$queryRaw<{ id: string; avg: number | null }[]>`
          select q."courseId" id, avg(qa.score)::float avg from quiz_attempts qa join quizzes q on q.id = qa."quizId"
          where qa.status = 'GRADED' and q."courseId" in (${Prisma.join(courseIds)}) group by 1`
      : Promise.resolve([] as { id: string; avg: number | null }[]),
    db.enrollment.findMany({
      where: { ...inCourses, status: { not: "CANCELLED" } },
      orderBy: { enrolledAt: "desc" },
      take: 30,
      select: { id: true, status: true, progressPercent: true, enrolledAt: true, lastAccessedAt: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } }, course: { select: { title: true } } },
    }),
    db.assignmentSubmission.findMany({
      where: { assignment: inCourses },
      orderBy: { submittedAt: "desc" },
      take: 30,
      select: { id: true, status: true, score: true, submittedAt: true, gradedAt: true, user: { select: { id: true, name: true } }, assignment: { select: { title: true, maxScore: true, course: { select: { title: true } } } } },
    }),
    db.quizAttempt.findMany({
      where: { quiz: inCourses, status: { not: "IN_PROGRESS" } },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: { id: true, score: true, passed: true, status: true, submittedAt: true, startedAt: true, user: { select: { id: true, name: true } }, quiz: { select: { title: true, course: { select: { title: true } } } } },
    }),
  ]);
  const perCourse = new Map<string, { students: number; completed: number; avgProgress: number; avgQuiz: number | null }>();
  for (const c of courses) perCourse.set(c.id, { students: 0, completed: 0, avgProgress: 0, avgQuiz: null });
  for (const r of byCourse) {
    const m = perCourse.get(r.courseId)!;
    if (r.status !== "CANCELLED") m.students += r._count._all;
    if (r.status === "COMPLETED") m.completed += r._count._all;
  }
  for (const r of avgByCourse) perCourse.get(r.courseId)!.avgProgress = Math.round(r._avg.progressPercent ?? 0);
  for (const r of quizByCourse) if (perCourse.has(r.id)) perCourse.get(r.id)!.avgQuiz = r.avg == null ? null : Number(r.avg);
  return {
    user: { ...user, roles: rolesOf(user) },
    metrics: metrics.get(id)!,
    courses: courses.map((c) => ({ ...c, ...perCourse.get(c.id)! })),
    students,
    submissions,
    attempts,
  };
}
