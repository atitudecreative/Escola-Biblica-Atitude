import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import type { Prisma, CourseLevel } from "@prisma/client";
import type { SessionUser } from "@/server/auth/session";
import { canManageCourse } from "./access";

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  coverUrl: true,
  level: true,
  durationMinutes: true,
  ratingAvg: true,
  ratingCount: true,
  enrollmentCount: true,
  publishedAt: true,
  category: { select: { name: true, slug: true, position: true } },
  instructor: { select: { id: true, name: true } },
} satisfies Prisma.CourseSelect;

export type CatalogCourse = Prisma.CourseGetPayload<{ select: typeof cardSelect }>;

export const DURATION_BUCKETS = {
  short: { label: "Até 2 horas", min: 0, max: 120 },
  medium: { label: "2 a 6 horas", min: 120, max: 360 },
  long: { label: "Mais de 6 horas", min: 360, max: 100_000 },
} as const;

export type CatalogFilters = {
  q?: string;
  category?: string;
  level?: CourseLevel;
  duration?: keyof typeof DURATION_BUCKETS;
  teacher?: string;
  rating?: number;
  sort?: "popular" | "newest" | "rating" | "title";
  page?: number;
};

export const PAGE_SIZE = 12;

export async function listCatalog(f: CatalogFilters) {
  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };
  if (f.q) {
    const contains = { contains: f.q, mode: "insensitive" as const };
    where.OR = [{ title: contains }, { subtitle: contains }, { description: contains }, { instructor: { name: contains } }, { tags: { some: { tag: { name: contains } } } }];
  }
  if (f.category) where.category = { slug: f.category };
  if (f.level) where.level = f.level;
  if (f.duration) where.durationMinutes = { gte: DURATION_BUCKETS[f.duration].min, lt: DURATION_BUCKETS[f.duration].max };
  if (f.teacher) where.instructorId = f.teacher;
  if (f.rating) where.ratingAvg = { gte: f.rating };

  const orderBy: Prisma.CourseOrderByWithRelationInput[] =
    f.sort === "newest"
      ? [{ publishedAt: "desc" }]
      : f.sort === "rating"
        ? [{ ratingAvg: "desc" }, { ratingCount: "desc" }]
        : f.sort === "title"
          ? [{ title: "asc" }]
          : [{ enrollmentCount: "desc" }, { ratingAvg: "desc" }];

  const page = Math.max(1, f.page ?? 1);
  const [items, total] = await Promise.all([
    db.course.findMany({ where, orderBy, select: cardSelect, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    db.course.count({ where }),
  ]);
  return { items, total, page };
}

export const catalogFacets = cache(async () => {
  const [categories, teachers] = await Promise.all([
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, slug: true, icon: true, description: true, position: true, _count: { select: { courses: { where: { status: "PUBLISHED" } } } } },
    }),
    db.user.findMany({
      where: { taughtCourses: { some: { status: "PUBLISHED" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { categories, teachers };
});

/** Mapa courseId → progresso/conclusão do usuário (para cards). */
export async function enrollmentMap(userId: string | undefined, courseIds: string[]) {
  if (!userId || !courseIds.length) return new Map<string, { progress: number; completed: boolean }>();
  const rows = await db.enrollment.findMany({
    where: { userId, courseId: { in: courseIds }, status: { not: "CANCELLED" } },
    select: { courseId: true, progressPercent: true, status: true },
  });
  return new Map(rows.map((r) => [r.courseId, { progress: r.progressPercent, completed: r.status === "COMPLETED" }]));
}

export function withProgress<T extends { id: string }>(courses: T[], map: Map<string, { progress: number; completed: boolean }>) {
  return courses.map((c) => ({ ...c, progress: map.get(c.id)?.progress ?? null, completed: map.get(c.id)?.completed ?? false }));
}

export async function homeCollections(featuredIds: string[]) {
  const [featured, popular, newest] = await Promise.all([
    featuredIds.length
      ? db.course.findMany({ where: { id: { in: featuredIds }, status: "PUBLISHED" }, select: cardSelect })
      : db.course.findMany({ where: { status: "PUBLISHED", isFeatured: true }, select: cardSelect, take: 4 }),
    db.course.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ enrollmentCount: "desc" }], select: cardSelect, take: 4 }),
    db.course.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ publishedAt: "desc" }], select: cardSelect, take: 4 }),
  ]);
  // Mantém a ordem definida pelo administrador no CMS.
  const order = new Map(featuredIds.map((id, i) => [id, i]));
  featured.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  return { featured, popular, newest };
}

export async function featuredTeachers(take = 3) {
  const teachers = await db.user.findMany({
    where: { status: "ACTIVE", taughtCourses: { some: { status: "PUBLISHED" } } },
    select: {
      id: true,
      name: true,
      headline: true,
      bio: true,
      avatarUrl: true,
      taughtCourses: { where: { status: "PUBLISHED" }, select: { enrollmentCount: true, ratingAvg: true } },
    },
  });
  return teachers
    .map((t) => ({
      ...t,
      students: t.taughtCourses.reduce((s, c) => s + c.enrollmentCount, 0),
      courses: t.taughtCourses.length,
    }))
    .sort((a, b) => b.students - a.students)
    .slice(0, take);
}

export async function platformNumbers() {
  const [students, courses, certificates, hours] = await Promise.all([
    db.user.count({ where: { roles: { some: { role: { key: "student" } } } } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.certificate.count({ where: { revokedAt: null } }),
    db.userActivityDay.aggregate({ _sum: { seconds: true } }),
  ]);
  return { students, courses, certificates, hours: Math.round((hours._sum.seconds ?? 0) / 3600) };
}

/** Página do curso: estrutura publicada, professor, materiais, avaliações e estado do usuário. */
export async function getCoursePage(slug: string, user: SessionUser | null) {
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      category: true,
      instructor: { select: { id: true, name: true, headline: true, bio: true, avatarUrl: true } },
      tags: { include: { tag: true } },
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { position: "asc" },
            select: { id: true, title: true, type: true, durationSeconds: true, isPreview: true },
          },
        },
      },
      materials: { where: { lessonId: null }, orderBy: { position: "asc" }, include: { file: { select: { id: true, mimeType: true, sizeBytes: true, originalName: true } } } },
      reviews: { orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { name: true, avatarUrl: true } } } },
      _count: { select: { quizzes: true, assignments: true, materials: true } },
    },
  });
  if (!course) return null;
  const manager = canManageCourse(user, course);
  const viewer = user?.permissions.has("courses.view_all") ?? false;
  if (course.status !== "PUBLISHED" && course.status !== "ARCHIVED" && !manager && !viewer) return null;

  const enrollment = user
    ? await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } })
    : null;
  const [ratingDist, isFavorite, myReview] = await Promise.all([
    db.courseReview.groupBy({ by: ["rating"], where: { courseId: course.id }, _count: true }),
    user ? db.favorite.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }) : null,
    user ? db.courseReview.findUnique({ where: { courseId_userId: { courseId: course.id, userId: user.id } } }) : null,
  ]);
  const completedIds = enrollment
    ? new Set((await db.lessonProgress.findMany({ where: { userId: user!.id, courseId: course.id, status: "COMPLETED" }, select: { lessonId: true } })).map((p) => p.lessonId))
    : new Set<string>();

  return {
    course,
    manager,
    enrollment: enrollment && enrollment.status !== "CANCELLED" ? enrollment : null,
    ratingDist: Object.fromEntries(ratingDist.map((r) => [r.rating, r._count])) as Record<number, number>,
    isFavorite: !!isFavorite,
    myReview,
    completedIds,
    lessonCount: course.modules.reduce((s, m) => s + m.lessons.length, 0),
  };
}

// ── Home ──────────────────────────────────────────────────────────

const showcaseSelect = {
  ...cardSelect,
  description: true,
  priceCents: true,
  category: { select: { name: true, slug: true, position: true } },
  instructor: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { lessons: { where: { isPublished: true } } } },
} satisfies Prisma.CourseSelect;

type ShowcaseRow = Prisma.CourseGetPayload<{ select: typeof showcaseSelect }>;

/** Texto curto para o card expandido: subtítulo ou o início da descrição, sem Markdown. */
function excerpt(c: Pick<ShowcaseRow, "subtitle" | "description">, max = 240) {
  const plain = (c.description ?? "")
    .replace(/[#>*_`~[\]()!-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = plain || c.subtitle || "";
  return base.length > max ? `${base.slice(0, max).replace(/\s+\S*$/, "")}…` : base;
}

export type ShowcaseCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  coverUrl: string | null;
  level: CourseLevel;
  durationMinutes: number;
  lessonCount: number;
  ratingAvg: number;
  ratingCount: number;
  enrollmentCount: number;
  paid: boolean;
  category: { name: string; slug: string; position: number } | null;
  instructor: { id: string; name: string; avatarUrl: string | null };
  enrollment: "none" | "active" | "completed";
  progress: number | null;
};

function toShowcase(c: ShowcaseRow, map: Map<string, { progress: number; completed: boolean }>): ShowcaseCourse {
  const e = map.get(c.id);
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    excerpt: excerpt(c),
    coverUrl: c.coverUrl,
    level: c.level,
    durationMinutes: c.durationMinutes,
    lessonCount: c._count.lessons,
    ratingAvg: c.ratingAvg,
    ratingCount: c.ratingCount,
    enrollmentCount: c.enrollmentCount,
    paid: c.priceCents > 0,
    category: c.category,
    instructor: c.instructor,
    enrollment: e ? (e.completed ? "completed" : "active") : "none",
    progress: e?.progress ?? null,
  };
}

/**
 * Dados da Home: destaques (ordem do CMS), catálogo para "Explore por área"
 * e o curso do banner principal com o sumário (módulos) para o hero.
 */
export async function homeShowcase(userId: string | undefined, featuredIds: string[], bannerHref: string | null) {
  const [featuredRows, catalogRows] = await Promise.all([
    featuredIds.length
      ? db.course.findMany({ where: { id: { in: featuredIds }, status: "PUBLISHED" }, select: showcaseSelect })
      : db.course.findMany({ where: { status: "PUBLISHED", isFeatured: true }, orderBy: [{ enrollmentCount: "desc" }], select: showcaseSelect, take: 6 }),
    db.course.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ enrollmentCount: "desc" }, { ratingAvg: "desc" }], select: showcaseSelect, take: 60 }),
  ]);
  const order = new Map(featuredIds.map((id, i) => [id, i]));
  featuredRows.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  const map = await enrollmentMap(userId, [...new Set([...featuredRows, ...catalogRows].map((c) => c.id))]);
  // Três destaques: uma linha limpa no desktop, sem card órfão.
  const featured = featuredRows.slice(0, 3).map((c) => toShowcase(c, map));
  // No explorador, o que ainda não apareceu nos destaques vem primeiro (ordem estável).
  const shown = new Set(featured.map((c) => c.id));
  const catalog = [...catalogRows.filter((c) => !shown.has(c.id)), ...catalogRows.filter((c) => shown.has(c.id))].map((c) => toShowcase(c, map));

  // Curso do hero: o que o banner divulga (/courses/slug) ou o primeiro destaque.
  const slugFromBanner = bannerHref?.match(/^\/courses\/([^/?#]+)/)?.[1];
  const heroSlug = slugFromBanner ?? featured[0]?.slug ?? catalog[0]?.slug;
  const hero = heroSlug
    ? await db.course.findFirst({
        where: { slug: heroSlug, status: "PUBLISHED" },
        select: {
          ...showcaseSelect,
          modules: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, _count: { select: { lessons: { where: { isPublished: true } } } } },
          },
        },
      })
    : null;

  return {
    featured,
    catalog,
    hero: hero
      ? {
          ...toShowcase(hero, map),
          modules: hero.modules.filter((m) => m._count.lessons > 0).map((m) => ({ id: m.id, title: m.title, lessons: m._count.lessons })),
        }
      : null,
  };
}

export type HeroCourse = NonNullable<Awaited<ReturnType<typeof homeShowcase>>["hero"]>;
