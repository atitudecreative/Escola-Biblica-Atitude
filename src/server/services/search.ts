import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";

export type SearchGroup = {
  key: "courses" | "lessons" | "materials" | "teachers" | "students" | "discussions";
  label: string;
  items: { id: string; title: string; subtitle?: string; href: string }[];
};

/**
 * Busca global agrupada, respeitando permissões:
 *  - cursos publicados para todos; rascunhos só para quem gerencia;
 *  - aulas e materiais apenas de cursos publicados (ou próprios/gerenciáveis);
 *  - alunos apenas para quem tem students.view_all / users.view (ou do próprio curso, p/ professor);
 *  - discussões não removidas.
 */
/** IDs cujas colunas contêm o termo, ignorando maiúsculas e acentos (extensão unaccent). */
async function matchIds(table: string, columns: string[], term: string, limit = 200) {
  const pattern = `%${term.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const where = Prisma.join(
    columns.map((c) => Prisma.sql`f_unaccent(lower(${Prisma.raw(c)})) LIKE f_unaccent(lower(${pattern}))`),
    " OR ",
  );
  const rows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM ${Prisma.raw(table)} WHERE ${where} LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

export async function globalSearch(user: SessionUser, q: string, take = 5): Promise<SearchGroup[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const [courseIds, tagCourseIds, lessonIds, materialIds, userIds, threadIds] = await Promise.all([
    matchIds("courses", ['"title"', '"subtitle"'], term),
    db.$queryRaw<{ id: string }[]>`SELECT ct."courseId" AS id FROM course_tags ct JOIN tags t ON t.id = ct."tagId" WHERE f_unaccent(lower(t.name)) LIKE f_unaccent(lower(${`%${term}%`}))`.then((r) => r.map((x) => x.id)),
    matchIds("lessons", ['"title"'], term),
    matchIds("lesson_materials", ['"title"'], term),
    matchIds("users", ['"name"', '"email"'], term),
    matchIds("discussion_threads", ['"title"', '"body"'], term),
  ]);
  const byId = (ids: string[]) => ({ id: { in: ids } });
  const canSeeAll = user.permissions.has("courses.view_all") || user.permissions.has("courses.manage_any");
  const courseScope = canSeeAll ? {} : { OR: [{ status: "PUBLISHED" as const }, { instructorId: user.id }] };
  const canSeeStudents = user.permissions.has("students.view_all") || user.permissions.has("users.view");
  const teacherScope = user.permissions.has("students.view_own");

  const [courses, lessons, materials, teachers, students, threads] = await Promise.all([
    db.course.findMany({
      where: { ...courseScope, ...byId([...courseIds, ...tagCourseIds]) },
      select: { id: true, slug: true, title: true, instructor: { select: { name: true } }, status: true },
      take,
    }),
    db.lesson.findMany({
      where: { ...byId(lessonIds), isPublished: true, course: courseScope },
      select: { id: true, title: true, courseId: true, course: { select: { title: true } } },
      take,
    }),
    db.material.findMany({
      where: { ...byId(materialIds), course: courseScope },
      select: { id: true, title: true, course: { select: { title: true, slug: true } } },
      take,
    }),
    db.user.findMany({
      where: { status: "ACTIVE", ...byId(userIds), roles: { some: { role: { key: "teacher" } } } },
      select: { id: true, name: true, headline: true },
      take,
    }),
    canSeeStudents || teacherScope
      ? db.user.findMany({
          where: {
            ...byId(userIds),
            roles: { some: { role: { key: "student" } } },
            ...(canSeeStudents ? {} : { enrollments: { some: { course: { instructorId: user.id } } } }),
          },
          select: { id: true, name: true, email: true },
          take,
        })
      : Promise.resolve([]),
    db.discussionThread.findMany({
      where: { deletedAt: null, ...byId(threadIds) },
      select: { id: true, title: true, replyCount: true },
      orderBy: { lastActivityAt: "desc" },
      take,
    }),
  ]);

  const groups: SearchGroup[] = [
    {
      key: "courses",
      label: "Cursos",
      items: courses.map((c) => ({ id: c.id, title: c.title, subtitle: c.instructor.name, href: `/courses/${c.slug}` })),
    },
    {
      key: "lessons",
      label: "Aulas",
      items: lessons.map((l) => ({ id: l.id, title: l.title, subtitle: l.course.title, href: `/learn/${l.courseId}/${l.id}` })),
    },
    {
      key: "materials",
      label: "Materiais",
      items: materials.map((m) => ({ id: m.id, title: m.title, subtitle: m.course.title, href: `/courses/${m.course.slug}#materiais` })),
    },
    {
      key: "teachers",
      label: "Professores",
      items: teachers.map((t) => ({ id: t.id, title: t.name, subtitle: t.headline ?? "Professor", href: `/teachers/${t.id}` })),
    },
    {
      key: "students",
      label: "Alunos",
      items: students.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.email,
        href: canSeeStudents ? `/admin/students/${s.id}` : `/teacher/students?q=${encodeURIComponent(s.email)}`,
      })),
    },
    {
      key: "discussions",
      label: "Discussões",
      items: threads.map((t) => ({ id: t.id, title: t.title, subtitle: `${t.replyCount} respostas`, href: `/community/${t.id}` })),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}
