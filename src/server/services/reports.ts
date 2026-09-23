import "server-only";
import { Prisma, type EnrollmentStatus, type SubmissionStatus, type UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { assertPermission } from "@/server/auth/guards";
import { bucketRange, chartWindow, fillSeries, studentWhere, teacherWhere } from "@/server/services/analytics";
import { studentMetrics, teacherMetrics } from "@/server/services/users-admin";
import { ENROLLMENT_STATUS, SUBMISSION_STATUS, USER_STATUS, COURSE_STATUS, type Tone } from "@/lib/labels";
import type { Period, PeriodKey } from "@/lib/analytics-period";
import type { CourseStatus } from "@prisma/client";

/**
 * Relatórios gerenciais. Cada relatório declara colunas tipadas e uma função
 * `load` que devolve linhas "cruas" (números, datas, selos). A mesma definição
 * alimenta a tabela paginada da tela e a exportação CSV (sem paginação).
 */

export type ColumnType = "text" | "number" | "percent" | "date" | "datetime" | "duration" | "badge" | "decimal";
export type Column = { key: string; label: string; type?: ColumnType; /** destaque na lista mobile */ primary?: boolean; secondary?: boolean; hideMobile?: boolean };
export type BadgeCell = { label: string; tone: Tone };
export type Cell = string | number | Date | BadgeCell | null;
export type ReportRow = { id: string; href?: string } & Record<string, Cell | string | undefined>;

export type ReportChart =
  | { kind: "column" | "trend"; title: string; description?: string; xKey: string; data: Record<string, string | number>[]; series: { key: string; label: string; slot?: 1 | 2 | 3 | 4 | 5 }[]; format?: "number" | "hours" | "percent" }
  | { kind: "bars"; title: string; description?: string; items: { label: string; value: number; hint?: string }[]; format?: "number" | "percent" };

export type ReportFilters = { period: Period; courseId?: string; status?: string; q?: string; ids?: string[] };
type Paging = { skip: number; take: number } | null;
type LoadResult = { rows: ReportRow[]; total: number };

export type ReportDef = {
  key: string;
  label: string;
  description: string;
  /** a que data o filtro de período se refere */
  dateLabel?: string;
  defaultPeriod: PeriodKey;
  course?: boolean;
  statusOptions?: { value: string; label: string }[];
  columns: Column[];
  load: (f: ReportFilters, paging: Paging) => Promise<LoadResult>;
  chart?: (f: ReportFilters) => Promise<ReportChart | null>;
  hidden?: boolean;
};

const DAY = 86_400_000;
const badge = (b: { label: string; tone: Tone }): BadgeCell => ({ label: b.label, tone: b.tone });
const dateRange = (p: Period) => (p.from ? { gte: p.from, lt: p.to } : undefined);
const pg = (paging: Paging): { skip: number; take: number } => (paging ? { skip: paging.skip, take: paging.take } : { skip: 0, take: 20_000 });
const qUser = (q?: string): Prisma.UserWhereInput | undefined =>
  q?.trim() ? { OR: [{ name: { contains: q.trim(), mode: "insensitive" } }, { email: { contains: q.trim(), mode: "insensitive" } }] } : undefined;
const statusOpts = <K extends string>(m: Record<K, { label: string }>, keys?: K[]) => (keys ?? (Object.keys(m) as K[])).map((k) => ({ value: k, label: m[k].label }));

/** Série de contagem por bucket para qualquer tabela/coluna de data (identificadores fixos, nunca do usuário). */
async function countSeries(p: Period, table: string, column: string, extra: Prisma.Sql = Prisma.empty, earliest?: Date | null) {
  const w = chartWindow(p, earliest);
  const rows = await db.$queryRaw<{ b: Date; c: number }[]>`
    select date_trunc(${w.bucket}, t.${Prisma.raw(`"${column}"`)}) b, count(*)::int c from ${Prisma.raw(table)} t
    where t.${Prisma.raw(`"${column}"`)} >= ${w.from} and t.${Prisma.raw(`"${column}"`)} < ${w.to} ${extra} group by 1`;
  return fillSeries(bucketRange(w.from, w.to, w.bucket), w.bucket, rows, { c: (r) => Number(r.c) });
}

async function earliestOf(p: Period, fn: () => Promise<Date | null | undefined>) {
  return p.from ? null : ((await fn()) ?? null);
}

// ── Definições ────────────────────────────────────────────────────

const students: ReportDef = {
  key: "students",
  label: "Alunos",
  description: "Base de alunos com engajamento e desempenho consolidados.",
  dateLabel: "data de cadastro",
  defaultPeriod: "all",
  course: true,
  statusOptions: statusOpts(USER_STATUS),
  columns: [
    { key: "name", label: "Aluno", primary: true },
    { key: "email", label: "E-mail", secondary: true },
    { key: "status", label: "Status", type: "badge" },
    { key: "courses", label: "Cursos", type: "number" },
    { key: "completed", label: "Concluídos", type: "number" },
    { key: "avgProgress", label: "Progresso médio", type: "percent" },
    { key: "seconds", label: "Tempo de estudo", type: "duration" },
    { key: "xp", label: "XP", type: "number", hideMobile: true },
    { key: "lastSeenAt", label: "Último acesso", type: "datetime", hideMobile: true },
    { key: "createdAt", label: "Cadastro", type: "date" },
  ],
  async load(f, paging) {
    const where: Prisma.UserWhereInput = {
      AND: [
        studentWhere,
        qUser(f.q) ?? {},
        f.status ? { status: f.status as UserStatus } : {},
        f.period.from ? { createdAt: dateRange(f.period) } : {},
        f.courseId ? { enrollments: { some: { courseId: f.courseId, status: { not: "CANCELLED" } } } } : {},
      ],
    };
    const [rows, total] = await Promise.all([
      db.user.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], ...pg(paging), select: { id: true, name: true, email: true, status: true, xp: true, lastSeenAt: true, createdAt: true } }),
      db.user.count({ where }),
    ]);
    const m = await studentMetrics(rows.map((r) => r.id));
    return {
      total,
      rows: rows.map((u) => {
        const x = m.get(u.id)!;
        return { id: u.id, href: `/admin/students/${u.id}`, name: u.name, email: u.email, status: badge(USER_STATUS[u.status]), courses: x.courses, completed: x.completed, avgProgress: x.avgProgress, seconds: x.seconds, xp: u.xp, lastSeenAt: u.lastSeenAt, createdAt: u.createdAt };
      }),
    };
  },
  async chart(f) {
    const earliest = await earliestOf(f.period, async () => (await db.user.aggregate({ _min: { createdAt: true } }))._min.createdAt);
    const data = await countSeries(f.period, "users", "createdAt", Prisma.sql`and exists (select 1 from user_roles ur join roles r on r.id = ur."roleId" where ur."userId" = t.id and r.key = 'student') and not exists (select 1 from user_roles ur join roles r on r.id = ur."roleId" where ur."userId" = t.id and r.key in ('teacher','manager','admin'))`, earliest);
    return { kind: "column", title: "Novos alunos", description: "Cadastros por período", xKey: "label", data, series: [{ key: "c", label: "Novos alunos", slot: 1 }] };
  },
};

const courses: ReportDef = {
  key: "courses",
  label: "Cursos",
  description: "Desempenho de cada curso: matrículas, conclusão, progresso e avaliações.",
  dateLabel: "data de matrícula (contagens)",
  defaultPeriod: "all",
  statusOptions: statusOpts(COURSE_STATUS),
  columns: [
    { key: "title", label: "Curso", primary: true },
    { key: "instructor", label: "Professor", secondary: true },
    { key: "status", label: "Status", type: "badge" },
    { key: "lessons", label: "Aulas", type: "number" },
    { key: "enrollments", label: "Matrículas", type: "number" },
    { key: "completed", label: "Concluídas", type: "number" },
    { key: "completionRate", label: "Taxa de conclusão", type: "percent" },
    { key: "avgProgress", label: "Progresso médio", type: "percent" },
    { key: "avgQuiz", label: "Nota média (avaliações)", type: "percent", hideMobile: true },
    { key: "rating", label: "Avaliação (1–5)", type: "decimal", hideMobile: true },
    { key: "publishedAt", label: "Publicado em", type: "date", hideMobile: true },
  ],
  async load(f, paging) {
    const where: Prisma.CourseWhereInput = {
      ...(f.status ? { status: f.status as CourseStatus } : {}),
      ...(f.q?.trim() ? { title: { contains: f.q.trim(), mode: "insensitive" } } : {}),
    };
    const [rows, total] = await Promise.all([
      db.course.findMany({
        where,
        orderBy: [{ enrollmentCount: "desc" }, { title: "asc" }],
        ...pg(paging),
        select: { id: true, title: true, status: true, ratingAvg: true, ratingCount: true, publishedAt: true, instructor: { select: { name: true } }, _count: { select: { lessons: { where: { isPublished: true } } } } },
      }),
      db.course.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);
    const enrolledAt = dateRange(f.period);
    const [byStatus, avg, quiz] = await Promise.all([
      db.enrollment.groupBy({ by: ["courseId", "status"], where: { courseId: { in: ids }, ...(enrolledAt ? { enrolledAt } : {}) }, _count: { _all: true } }),
      db.enrollment.groupBy({ by: ["courseId"], where: { courseId: { in: ids }, status: { not: "CANCELLED" }, ...(enrolledAt ? { enrolledAt } : {}) }, _avg: { progressPercent: true } }),
      ids.length
        ? db.$queryRaw<{ id: string; avg: number | null }[]>`select q."courseId" id, avg(qa.score)::float avg from quiz_attempts qa join quizzes q on q.id = qa."quizId" where qa.status = 'GRADED' and q."courseId" in (${Prisma.join(ids)}) group by 1`
        : Promise.resolve([]),
    ]);
    const stat = new Map(ids.map((id) => [id, { enrollments: 0, completed: 0, avg: 0, quiz: null as number | null }]));
    for (const r of byStatus) {
      const s = stat.get(r.courseId)!;
      if (r.status !== "CANCELLED") s.enrollments += r._count._all;
      if (r.status === "COMPLETED") s.completed += r._count._all;
    }
    for (const r of avg) stat.get(r.courseId)!.avg = Math.round(r._avg.progressPercent ?? 0);
    for (const r of quiz) if (stat.has(r.id)) stat.get(r.id)!.quiz = r.avg == null ? null : Math.round(Number(r.avg));
    return {
      total,
      rows: rows.map((c) => {
        const s = stat.get(c.id)!;
        return {
          id: c.id, title: c.title, instructor: c.instructor.name, status: badge(COURSE_STATUS[c.status]), lessons: c._count.lessons,
          enrollments: s.enrollments, completed: s.completed, completionRate: s.enrollments ? Math.round((s.completed / s.enrollments) * 100) : 0,
          avgProgress: s.avg, avgQuiz: s.quiz, rating: c.ratingCount ? Math.round(c.ratingAvg * 10) / 10 : null, publishedAt: c.publishedAt,
        };
      }),
    };
  },
  async chart(f) {
    const enrolledAt = dateRange(f.period);
    const rows = await db.enrollment.groupBy({ by: ["courseId"], where: { status: { not: "CANCELLED" }, ...(enrolledAt ? { enrolledAt } : {}) }, _count: { _all: true }, orderBy: { _count: { courseId: "desc" } }, take: 8 });
    const titles = await db.course.findMany({ where: { id: { in: rows.map((r) => r.courseId) } }, select: { id: true, title: true } });
    const t = new Map(titles.map((c) => [c.id, c.title]));
    return { kind: "bars", title: "Matrículas por curso", description: "Os 8 cursos com mais matrículas no período", items: rows.map((r) => ({ label: t.get(r.courseId) ?? "—", value: r._count._all })) };
  },
};

const ENROLL_STATUS_KEYS = Object.keys(ENROLLMENT_STATUS) as EnrollmentStatus[];
const SOURCE_LABEL: Record<string, string> = { SELF: "Autoinscrição", ADMIN: "Secretaria", PURCHASE: "Compra" };

const enrollments: ReportDef = {
  key: "enrollments",
  label: "Matrículas",
  description: "Todas as matrículas com origem, situação e progresso.",
  dateLabel: "data de matrícula",
  defaultPeriod: "90d",
  course: true,
  statusOptions: statusOpts(ENROLLMENT_STATUS),
  columns: [
    { key: "student", label: "Aluno", primary: true },
    { key: "email", label: "E-mail", hideMobile: true },
    { key: "course", label: "Curso", secondary: true },
    { key: "status", label: "Situação", type: "badge" },
    { key: "source", label: "Origem" },
    { key: "progress", label: "Progresso", type: "percent" },
    { key: "enrolledAt", label: "Matrícula", type: "date" },
    { key: "completedAt", label: "Conclusão", type: "date", hideMobile: true },
    { key: "lastAccessedAt", label: "Último acesso", type: "datetime", hideMobile: true },
  ],
  async load(f, paging) {
    const where: Prisma.EnrollmentWhereInput = {
      ...(dateRange(f.period) ? { enrolledAt: dateRange(f.period) } : {}),
      ...(f.courseId ? { courseId: f.courseId } : {}),
      ...(ENROLL_STATUS_KEYS.includes(f.status as EnrollmentStatus) ? { status: f.status as EnrollmentStatus } : {}),
      ...(qUser(f.q) ? { user: qUser(f.q) } : {}),
    };
    const [rows, total] = await Promise.all([
      db.enrollment.findMany({ where, orderBy: [{ enrolledAt: "desc" }, { id: "asc" }], ...pg(paging), select: { id: true, status: true, source: true, progressPercent: true, enrolledAt: true, completedAt: true, lastAccessedAt: true, user: { select: { id: true, name: true, email: true } }, course: { select: { title: true } } } }),
      db.enrollment.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((e) => ({ id: e.id, href: `/admin/students/${e.user.id}`, student: e.user.name, email: e.user.email, course: e.course.title, status: badge(ENROLLMENT_STATUS[e.status]), source: SOURCE_LABEL[e.source] ?? e.source, progress: e.progressPercent, enrolledAt: e.enrolledAt, completedAt: e.completedAt, lastAccessedAt: e.lastAccessedAt })),
    };
  },
  async chart(f) {
    const earliest = await earliestOf(f.period, async () => (await db.enrollment.aggregate({ _min: { enrolledAt: true } }))._min.enrolledAt);
    const extra = f.courseId ? Prisma.sql`and t."courseId" = ${f.courseId}` : Prisma.empty;
    const data = await countSeries(f.period, "enrollments", "enrolledAt", extra, earliest);
    return { kind: "column", title: "Matrículas no período", xKey: "label", data, series: [{ key: "c", label: "Matrículas", slot: 1 }] };
  },
};

const completion: ReportDef = {
  key: "completion",
  label: "Conclusão",
  description: "Cursos concluídos, tempo até a conclusão e certificado emitido.",
  dateLabel: "data de conclusão",
  defaultPeriod: "90d",
  course: true,
  statusOptions: [{ value: "with", label: "Com certificado" }, { value: "without", label: "Sem certificado" }],
  columns: [
    { key: "student", label: "Aluno", primary: true },
    { key: "email", label: "E-mail", hideMobile: true },
    { key: "course", label: "Curso", secondary: true },
    { key: "enrolledAt", label: "Matrícula", type: "date", hideMobile: true },
    { key: "completedAt", label: "Conclusão", type: "date" },
    { key: "days", label: "Dias até concluir", type: "number" },
    { key: "certificate", label: "Certificado" },
  ],
  async load(f, paging) {
    const where: Prisma.EnrollmentWhereInput = {
      status: "COMPLETED",
      ...(dateRange(f.period) ? { completedAt: dateRange(f.period) } : {}),
      ...(f.courseId ? { courseId: f.courseId } : {}),
      ...(f.status === "with" ? { certificate: { isNot: null } } : f.status === "without" ? { certificate: { is: null } } : {}),
      ...(qUser(f.q) ? { user: qUser(f.q) } : {}),
    };
    const [rows, total] = await Promise.all([
      db.enrollment.findMany({ where, orderBy: [{ completedAt: "desc" }, { id: "asc" }], ...pg(paging), select: { id: true, enrolledAt: true, completedAt: true, user: { select: { id: true, name: true, email: true } }, course: { select: { title: true } }, certificate: { select: { code: true, revokedAt: true } } } }),
      db.enrollment.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((e) => ({
        id: e.id, href: `/admin/students/${e.user.id}`, student: e.user.name, email: e.user.email, course: e.course.title, enrolledAt: e.enrolledAt, completedAt: e.completedAt,
        days: e.completedAt ? Math.max(0, Math.round((e.completedAt.getTime() - e.enrolledAt.getTime()) / DAY)) : null,
        certificate: e.certificate ? (e.certificate.revokedAt ? `${e.certificate.code} (revogado)` : e.certificate.code) : "—",
      })),
    };
  },
  async chart(f) {
    const earliest = await earliestOf(f.period, async () => (await db.enrollment.aggregate({ _min: { completedAt: true } }))._min.completedAt);
    const extra = Prisma.sql`and t.status = 'COMPLETED' ${f.courseId ? Prisma.sql`and t."courseId" = ${f.courseId}` : Prisma.empty}`;
    const data = await countSeries(f.period, "enrollments", "completedAt", extra, earliest);
    return { kind: "column", title: "Conclusões no período", xKey: "label", data, series: [{ key: "c", label: "Conclusões", slot: 2 }] };
  },
};

const PROGRESS_STATUS = [
  { value: "0-25", label: "Progresso 0–25%", min: 0, max: 25 },
  { value: "25-50", label: "Progresso 25–50%", min: 25, max: 50 },
  { value: "50-75", label: "Progresso 50–75%", min: 50, max: 75 },
  { value: "75-100", label: "Progresso 75–100%", min: 75, max: 101 },
  { value: "stalled", label: "Sem acesso há 14+ dias", min: 0, max: 101 },
];

const progress: ReportDef = {
  key: "progress",
  label: "Progresso",
  description: "Matrículas em andamento: onde cada aluno está e quem parou de estudar.",
  dateLabel: "data de matrícula",
  defaultPeriod: "all",
  course: true,
  statusOptions: PROGRESS_STATUS.map(({ value, label }) => ({ value, label })),
  columns: [
    { key: "student", label: "Aluno", primary: true },
    { key: "course", label: "Curso", secondary: true },
    { key: "progress", label: "Progresso", type: "percent" },
    { key: "lessons", label: "Aulas concluídas" },
    { key: "watched", label: "Tempo assistido", type: "duration" },
    { key: "lastAccessedAt", label: "Último acesso", type: "datetime" },
    { key: "situation", label: "Situação", type: "badge" },
  ],
  async load(f, paging) {
    const band = PROGRESS_STATUS.find((b) => b.value === f.status);
    const stalledBefore = new Date(Date.now() - 14 * DAY);
    const where: Prisma.EnrollmentWhereInput = {
      status: "ACTIVE",
      ...(dateRange(f.period) ? { enrolledAt: dateRange(f.period) } : {}),
      ...(f.courseId ? { courseId: f.courseId } : {}),
      ...(band && band.value !== "stalled" ? { progressPercent: { gte: band.min, lt: band.max } } : {}),
      ...(band?.value === "stalled" ? { OR: [{ lastAccessedAt: null }, { lastAccessedAt: { lt: stalledBefore } }] } : {}),
      ...(qUser(f.q) ? { user: qUser(f.q) } : {}),
    };
    const [rows, total] = await Promise.all([
      db.enrollment.findMany({ where, orderBy: [{ progressPercent: "desc" }, { id: "asc" }], ...pg(paging), select: { id: true, userId: true, courseId: true, progressPercent: true, lastAccessedAt: true, user: { select: { name: true } }, course: { select: { title: true } } } }),
      db.enrollment.count({ where }),
    ]);
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const courseIds = [...new Set(rows.map((r) => r.courseId))];
    const [prog, totals] = await Promise.all([
      db.lessonProgress.groupBy({ by: ["userId", "courseId", "status"], where: { userId: { in: userIds }, courseId: { in: courseIds } }, _count: { _all: true }, _sum: { watchedSeconds: true } }),
      db.lesson.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, isPublished: true }, _count: { _all: true } }),
    ]);
    const key = (u: string, c: string) => `${u}:${c}`;
    const agg = new Map<string, { done: number; watched: number }>();
    for (const p of prog) {
      const k = key(p.userId, p.courseId);
      const a = agg.get(k) ?? { done: 0, watched: 0 };
      if (p.status === "COMPLETED") a.done += p._count._all;
      a.watched += p._sum.watchedSeconds ?? 0;
      agg.set(k, a);
    }
    const lessonTotal = new Map(totals.map((t) => [t.courseId, t._count._all]));
    return {
      total,
      rows: rows.map((e) => {
        const a = agg.get(key(e.userId, e.courseId)) ?? { done: 0, watched: 0 };
        const situation: BadgeCell = !e.lastAccessedAt
          ? { label: "Nunca acessou", tone: "neutral" }
          : e.lastAccessedAt < stalledBefore
            ? { label: "Parado", tone: "warning" }
            : { label: "Estudando", tone: "success" };
        return { id: e.id, href: `/admin/students/${e.userId}`, student: e.user.name, course: e.course.title, progress: e.progressPercent, lessons: `${a.done}/${lessonTotal.get(e.courseId) ?? 0}`, watched: a.watched, lastAccessedAt: e.lastAccessedAt, situation };
      }),
    };
  },
  async chart(f) {
    const base: Prisma.EnrollmentWhereInput = { status: "ACTIVE", ...(dateRange(f.period) ? { enrolledAt: dateRange(f.period) } : {}), ...(f.courseId ? { courseId: f.courseId } : {}) };
    const bands = PROGRESS_STATUS.filter((b) => b.value !== "stalled");
    const counts = await Promise.all(bands.map((b) => db.enrollment.count({ where: { ...base, progressPercent: { gte: b.min, lt: b.max } } })));
    return { kind: "column", title: "Distribuição do progresso", description: "Matrículas em andamento por faixa de progresso", xKey: "label", data: bands.map((b, i) => ({ label: b.label.replace("Progresso ", ""), c: counts[i] })), series: [{ key: "c", label: "Matrículas", slot: 3 }] };
  },
};

const teachers: ReportDef = {
  key: "teachers",
  label: "Professores",
  description: "Cursos, alunos, resultados e ritmo de correção de cada professor.",
  dateLabel: "data das correções",
  defaultPeriod: "30d",
  statusOptions: statusOpts(USER_STATUS),
  columns: [
    { key: "name", label: "Professor", primary: true },
    { key: "email", label: "E-mail", secondary: true },
    { key: "status", label: "Status", type: "badge" },
    { key: "courses", label: "Cursos", type: "number" },
    { key: "published", label: "Publicados", type: "number" },
    { key: "students", label: "Alunos", type: "number" },
    { key: "completionRate", label: "Taxa de conclusão", type: "percent" },
    { key: "avgQuiz", label: "Nota média (avaliações)", type: "percent" },
    { key: "gradings", label: "Correções no período", type: "number" },
    { key: "pending", label: "Correções pendentes", type: "number" },
    { key: "rating", label: "Avaliação (1–5)", type: "decimal", hideMobile: true },
  ],
  async load(f, paging) {
    const where: Prisma.UserWhereInput = { AND: [teacherWhere, qUser(f.q) ?? {}, f.status ? { status: f.status as UserStatus } : {}] };
    const [rows, total] = await Promise.all([
      db.user.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], ...pg(paging), select: { id: true, name: true, email: true, status: true } }),
      db.user.count({ where }),
    ]);
    const m = await teacherMetrics(rows.map((r) => r.id), { from: f.period.from, to: f.period.to });
    return {
      total,
      rows: rows.map((u) => {
        const x = m.get(u.id)!;
        return { id: u.id, href: `/admin/teachers/${u.id}`, name: u.name, email: u.email, status: badge(USER_STATUS[u.status]), courses: x.courses, published: x.published, students: x.students, completionRate: Math.round(x.completionRate), avgQuiz: x.avgQuizScore == null ? null : Math.round(x.avgQuizScore), gradings: x.gradings, pending: x.pending, rating: x.rating == null ? null : Math.round(x.rating * 10) / 10 };
      }),
    };
  },
  async chart(f) {
    const res = await teachers.load({ ...f, status: undefined }, { skip: 0, take: 12 });
    return { kind: "bars", title: "Alunos por professor", description: "Matrículas ativas e concluídas nos cursos de cada professor", items: res.rows.map((r) => ({ label: String(r.name), value: Number(r.students), hint: `${r.completionRate}% de conclusão · ${r.pending} correções pendentes` })).sort((a, b) => b.value - a.value) };
  },
};

const SUB_KEYS = ["SUBMITTED", "GRADING", "RETURNED", "APPROVED", "REJECTED"] as SubmissionStatus[];

const submissions: ReportDef = {
  key: "submissions",
  label: "Atividades",
  description: "Entregas de atividades, status de correção e notas.",
  dateLabel: "data de envio",
  defaultPeriod: "90d",
  course: true,
  statusOptions: SUB_KEYS.map((k) => ({ value: k, label: SUBMISSION_STATUS[k].label })),
  columns: [
    { key: "student", label: "Aluno", primary: true },
    { key: "assignment", label: "Atividade", secondary: true },
    { key: "course", label: "Curso", hideMobile: true },
    { key: "status", label: "Status", type: "badge" },
    { key: "score", label: "Nota", type: "decimal" },
    { key: "maxScore", label: "Nota máxima", type: "number", hideMobile: true },
    { key: "submittedAt", label: "Enviada em", type: "datetime" },
    { key: "gradedAt", label: "Corrigida em", type: "datetime", hideMobile: true },
    { key: "grader", label: "Corrigida por", hideMobile: true },
  ],
  async load(f, paging) {
    const where: Prisma.AssignmentSubmissionWhereInput = {
      ...(dateRange(f.period) ? { submittedAt: dateRange(f.period) } : {}),
      ...(f.courseId ? { assignment: { courseId: f.courseId } } : {}),
      ...(SUB_KEYS.includes(f.status as SubmissionStatus) ? { status: f.status as SubmissionStatus } : {}),
      ...(qUser(f.q) ? { user: qUser(f.q) } : {}),
    };
    const [rows, total] = await Promise.all([
      db.assignmentSubmission.findMany({ where, orderBy: [{ submittedAt: "desc" }, { id: "asc" }], ...pg(paging), select: { id: true, status: true, score: true, submittedAt: true, gradedAt: true, user: { select: { id: true, name: true } }, gradedBy: { select: { name: true } }, assignment: { select: { title: true, maxScore: true, course: { select: { title: true } } } } } }),
      db.assignmentSubmission.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((s) => ({ id: s.id, href: `/admin/students/${s.user.id}`, student: s.user.name, assignment: s.assignment.title, course: s.assignment.course.title, status: badge(SUBMISSION_STATUS[s.status]), score: s.score, maxScore: s.assignment.maxScore, submittedAt: s.submittedAt, gradedAt: s.gradedAt, grader: s.gradedBy?.name ?? "—" })),
    };
  },
  async chart(f) {
    const rows = await db.assignmentSubmission.groupBy({
      by: ["status"],
      where: { ...(dateRange(f.period) ? { submittedAt: dateRange(f.period) } : {}), ...(f.courseId ? { assignment: { courseId: f.courseId } } : {}) },
      _count: { _all: true },
    });
    const m = new Map(rows.map((r) => [r.status, r._count._all]));
    return { kind: "bars", title: "Entregas por status", items: SUB_KEYS.map((k) => ({ label: SUBMISSION_STATUS[k].label, value: m.get(k) ?? 0 })) };
  },
};

const quizzes: ReportDef = {
  key: "quizzes",
  label: "Avaliações",
  description: "Tentativas de questionários, notas e aprovação.",
  dateLabel: "data de envio",
  defaultPeriod: "90d",
  course: true,
  statusOptions: [{ value: "passed", label: "Aprovado" }, { value: "failed", label: "Reprovado" }, { value: "pending", label: "Aguardando correção" }],
  columns: [
    { key: "student", label: "Aluno", primary: true },
    { key: "quiz", label: "Avaliação", secondary: true },
    { key: "course", label: "Curso", hideMobile: true },
    { key: "attempt", label: "Tentativa", type: "number" },
    { key: "score", label: "Nota", type: "percent" },
    { key: "result", label: "Resultado", type: "badge" },
    { key: "submittedAt", label: "Enviada em", type: "datetime" },
  ],
  async load(f, paging) {
    const statusWhere: Prisma.QuizAttemptWhereInput =
      f.status === "passed" ? { status: "GRADED", passed: true } : f.status === "failed" ? { status: "GRADED", passed: false } : f.status === "pending" ? { status: "PENDING_REVIEW" } : { status: { not: "IN_PROGRESS" } };
    const where: Prisma.QuizAttemptWhereInput = {
      ...statusWhere,
      ...(dateRange(f.period) ? { submittedAt: dateRange(f.period) } : {}),
      ...(f.courseId ? { quiz: { courseId: f.courseId } } : {}),
      ...(qUser(f.q) ? { user: qUser(f.q) } : {}),
    };
    const [rows, total] = await Promise.all([
      db.quizAttempt.findMany({ where, orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }], ...pg(paging), select: { id: true, attemptNumber: true, status: true, score: true, passed: true, submittedAt: true, user: { select: { id: true, name: true } }, quiz: { select: { title: true, course: { select: { title: true } } } } } }),
      db.quizAttempt.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((a) => ({
        id: a.id, href: `/admin/students/${a.user.id}`, student: a.user.name, quiz: a.quiz.title, course: a.quiz.course.title, attempt: a.attemptNumber,
        score: a.score == null ? null : Math.round(a.score),
        result: a.status === "PENDING_REVIEW" ? { label: "Aguardando correção", tone: "warning" } : a.passed ? { label: "Aprovado", tone: "success" } : { label: "Reprovado", tone: "danger" },
        submittedAt: a.submittedAt,
      })),
    };
  },
  async chart(f) {
    const range = dateRange(f.period);
    const rows = await db.$queryRaw<{ band: number; c: number }[]>`
      select least(width_bucket(qa.score, 0, 100, 5), 5)::int band, count(*)::int c from quiz_attempts qa join quizzes q on q.id = qa."quizId"
      where qa.status = 'GRADED' and qa.score is not null
      ${range ? Prisma.sql`and qa."submittedAt" >= ${range.gte} and qa."submittedAt" < ${range.lt}` : Prisma.empty}
      ${f.courseId ? Prisma.sql`and q."courseId" = ${f.courseId}` : Prisma.empty}
      group by 1`;
    const labels = ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"];
    const m = new Map(rows.map((r) => [Number(r.band), Number(r.c)]));
    return { kind: "column", title: "Distribuição das notas", description: "Tentativas corrigidas por faixa de nota", xKey: "label", data: labels.map((label, i) => ({ label, c: m.get(i + 1) ?? 0 })), series: [{ key: "c", label: "Tentativas", slot: 5 }] };
  },
};

const certificates: ReportDef = {
  key: "certificates",
  label: "Certificados",
  description: "Certificados emitidos, com código de validação e situação.",
  dateLabel: "data de emissão",
  defaultPeriod: "90d",
  course: true,
  statusOptions: [{ value: "valid", label: "Válido" }, { value: "revoked", label: "Revogado" }],
  columns: [
    { key: "code", label: "Código", secondary: true },
    { key: "student", label: "Aluno", primary: true },
    { key: "course", label: "Curso" },
    { key: "hours", label: "Carga horária (h)", type: "number" },
    { key: "issuedAt", label: "Emitido em", type: "date" },
    { key: "situation", label: "Situação", type: "badge" },
  ],
  async load(f, paging) {
    const term = f.q?.trim();
    const where: Prisma.CertificateWhereInput = {
      ...(dateRange(f.period) ? { issuedAt: dateRange(f.period) } : {}),
      ...(f.courseId ? { courseId: f.courseId } : {}),
      ...(f.status === "valid" ? { revokedAt: null } : f.status === "revoked" ? { revokedAt: { not: null } } : {}),
      ...(term ? { OR: [{ studentName: { contains: term, mode: "insensitive" } }, { code: { contains: term, mode: "insensitive" } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      db.certificate.findMany({ where, orderBy: [{ issuedAt: "desc" }, { id: "asc" }], ...pg(paging), select: { id: true, userId: true, code: true, studentName: true, courseTitle: true, workloadHours: true, issuedAt: true, revokedAt: true } }),
      db.certificate.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((c) => ({ id: c.id, href: `/admin/students/${c.userId}`, code: c.code, student: c.studentName, course: c.courseTitle, hours: c.workloadHours, issuedAt: c.issuedAt, situation: c.revokedAt ? { label: "Revogado", tone: "danger" } : { label: "Válido", tone: "success" } })),
    };
  },
  async chart(f) {
    const earliest = await earliestOf(f.period, async () => (await db.certificate.aggregate({ _min: { issuedAt: true } }))._min.issuedAt);
    const extra = Prisma.sql`and t."revokedAt" is null ${f.courseId ? Prisma.sql`and t."courseId" = ${f.courseId}` : Prisma.empty}`;
    const data = await countSeries(f.period, "certificates", "issuedAt", extra, earliest);
    return { kind: "column", title: "Certificados emitidos", xKey: "label", data, series: [{ key: "c", label: "Certificados", slot: 4 }] };
  },
};

const access: ReportDef = {
  key: "access",
  label: "Acessos",
  description: "Uso diário da plataforma: alunos ativos, horas de estudo, aulas concluídas e logins.",
  dateLabel: "dia",
  defaultPeriod: "30d",
  columns: [
    { key: "day", label: "Dia", type: "date", primary: true },
    { key: "active", label: "Alunos ativos", type: "number" },
    { key: "seconds", label: "Tempo de estudo", type: "duration" },
    { key: "lessons", label: "Aulas concluídas", type: "number" },
    { key: "logins", label: "Logins", type: "number" },
  ],
  async load(f, paging) {
    let from = f.period.from;
    if (!from) from = (await db.userActivityDay.aggregate({ _min: { date: true } }))._min.date ?? new Date(f.period.to.getTime() - 30 * DAY);
    const to = f.period.to;
    const [activity, logins] = await Promise.all([
      db.$queryRaw<{ d: Date; u: number; s: bigint; l: number }[]>`
        select a.date d, count(distinct a."userId")::int u, sum(a.seconds)::bigint s, sum(a.lessons)::int l from user_activity_days a
        where a.date >= ${from}::date and a.date < ${to}::date group by 1`,
      db.$queryRaw<{ d: Date; c: number }[]>`
        select date_trunc('day', "createdAt") d, count(*)::int c from audit_logs where action = 'auth.login' and "createdAt" >= ${from} and "createdAt" < ${to} group by 1`,
    ]);
    const a = new Map(activity.map((r) => [new Date(r.d).toISOString().slice(0, 10), r]));
    const lg = new Map(logins.map((r) => [new Date(r.d).toISOString().slice(0, 10), Number(r.c)]));
    const days: ReportRow[] = [];
    for (let d = new Date(to.getTime() - DAY); d >= from; d = new Date(d.getTime() - DAY)) {
      const k = d.toISOString().slice(0, 10);
      const r = a.get(k);
      days.push({ id: k, day: d, active: r ? Number(r.u) : 0, seconds: r ? Number(r.s) : 0, lessons: r ? Number(r.l) : 0, logins: lg.get(k) ?? 0 });
    }
    return { total: days.length, rows: paging ? days.slice(paging.skip, paging.skip + paging.take) : days };
  },
  async chart(f) {
    const w = chartWindow(f.period, f.period.from ? null : (await db.userActivityDay.aggregate({ _min: { date: true } }))._min.date);
    const rows = await db.$queryRaw<{ b: Date; u: number; s: bigint }[]>`
      select date_trunc(${w.bucket}, a.date::timestamp) b, count(distinct a."userId")::int u, sum(a.seconds)::bigint s from user_activity_days a
      where a.date >= ${w.from}::date and a.date < ${w.to}::date group by 1`;
    const data = fillSeries(bucketRange(w.from, w.to, w.bucket), w.bucket, rows, { active: (r) => Number(r.u) });
    return { kind: "trend", title: "Alunos ativos", description: w.bucket === "day" ? "Alunos distintos que estudaram em cada dia" : "Alunos distintos que estudaram em cada semana/mês", xKey: "label", data, series: [{ key: "active", label: "Alunos ativos", slot: 1 }] };
  },
};

/** Exportação da seleção em /admin/users (não aparece na lista de relatórios). */
const users: ReportDef = {
  key: "users",
  label: "Usuários",
  description: "Contas selecionadas",
  defaultPeriod: "all",
  hidden: true,
  statusOptions: statusOpts(USER_STATUS),
  columns: [
    { key: "name", label: "Nome", primary: true },
    { key: "email", label: "E-mail" },
    { key: "roles", label: "Perfis" },
    { key: "status", label: "Status", type: "badge" },
    { key: "emailVerified", label: "E-mail confirmado" },
    { key: "lastSeenAt", label: "Último acesso", type: "datetime" },
    { key: "createdAt", label: "Cadastro", type: "date" },
  ],
  async load(f, paging) {
    const where: Prisma.UserWhereInput = { AND: [f.ids?.length ? { id: { in: f.ids } } : {}, qUser(f.q) ?? {}, f.status ? { status: f.status as UserStatus } : {}] };
    const ROLE: Record<string, string> = { student: "Aluno", teacher: "Professor", manager: "Gestor", admin: "Administrador" };
    const [rows, total] = await Promise.all([
      db.user.findMany({ where, orderBy: [{ name: "asc" }], ...pg(paging), select: { id: true, name: true, email: true, status: true, emailVerifiedAt: true, lastSeenAt: true, createdAt: true, roles: { select: { role: { select: { key: true } } } } } }),
      db.user.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, roles: u.roles.map((r) => ROLE[r.role.key] ?? r.role.key).join(", "), status: badge(USER_STATUS[u.status]), emailVerified: u.emailVerifiedAt ? "Sim" : "Não", lastSeenAt: u.lastSeenAt, createdAt: u.createdAt })),
    };
  },
};

export const REPORTS: ReportDef[] = [students, courses, enrollments, completion, progress, teachers, submissions, quizzes, certificates, access, users];
export const REPORT_KEYS = REPORTS.map((r) => r.key);
export const getReportDef = (key: string | undefined) => REPORTS.find((r) => r.key === key);

export const REPORT_PAGE_SIZE = 25;

export async function runReport(def: ReportDef, f: ReportFilters, page: number) {
  await assertPermission("reports.view", "analytics.view");
  const [res, chart] = await Promise.all([def.load(f, { skip: (page - 1) * REPORT_PAGE_SIZE, take: REPORT_PAGE_SIZE }), def.chart ? def.chart(f) : Promise.resolve(null)]);
  return { ...res, chart };
}

// ── CSV ───────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
/** Datas no fuso de Brasília (UTC−3, sem horário de verão desde 2019). */
function brt(d: Date) {
  return new Date(d.getTime() - 3 * 3600_000);
}
function csvDate(d: Date, withTime: boolean) {
  const x = brt(d);
  const s = `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
  return withTime ? `${s} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}` : s;
}
const num = (n: number, digits = 0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits, useGrouping: false }).format(n);

function csvValue(v: Cell | string | undefined, type: ColumnType = "text") {
  if (v == null) return "";
  if (typeof v === "object" && !(v instanceof Date)) return v.label;
  if (v instanceof Date) return type === "date" ? csvDate(v, false) : csvDate(v, true);
  if (typeof v === "number") {
    if (type === "duration") return num(v / 3600, 2); // horas decimais (somáveis no Excel)
    if (type === "decimal") return num(v, 2);
    return num(v, 1);
  }
  return v;
}

function escapeCsv(s: string) {
  // Evita injeção de fórmulas ao abrir no Excel/Planilhas.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(def: ReportDef, rows: ReportRow[]) {
  const header = def.columns.map((c) => (c.type === "duration" ? `${c.label} (h)` : c.type === "percent" ? `${c.label} (%)` : c.label));
  const lines = [header.map(escapeCsv).join(";")];
  for (const r of rows) lines.push(def.columns.map((c) => escapeCsv(csvValue(r[c.key], c.type))).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export async function exportReport(def: ReportDef, f: ReportFilters) {
  if (def.key === "users") await assertPermission("users.view");
  const res = await def.load(f, null);
  return { csv: toCsv(def, res.rows), count: res.rows.length };
}
