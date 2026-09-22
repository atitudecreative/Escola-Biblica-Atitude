import "server-only";
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
export async function globalSearch(user: SessionUser, q: string, take = 5): Promise<SearchGroup[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const contains = { contains: term, mode: "insensitive" as const };
  const canSeeAll = user.permissions.has("courses.view_all") || user.permissions.has("courses.manage_any");
  const courseScope = canSeeAll ? {} : { OR: [{ status: "PUBLISHED" as const }, { instructorId: user.id }] };
  const canSeeStudents = user.permissions.has("students.view_all") || user.permissions.has("users.view");
  const teacherScope = user.permissions.has("students.view_own");

  const [courses, lessons, materials, teachers, students, threads] = await Promise.all([
    db.course.findMany({
      where: { ...courseScope, OR: [{ title: contains }, { subtitle: contains }, { tags: { some: { tag: { name: contains } } } }] },
      select: { id: true, slug: true, title: true, instructor: { select: { name: true } }, status: true },
      take,
    }),
    db.lesson.findMany({
      where: { title: contains, isPublished: true, course: courseScope },
      select: { id: true, title: true, courseId: true, course: { select: { title: true } } },
      take,
    }),
    db.material.findMany({
      where: { title: contains, course: courseScope },
      select: { id: true, title: true, course: { select: { title: true, slug: true } } },
      take,
    }),
    db.user.findMany({
      where: { status: "ACTIVE", name: contains, roles: { some: { role: { key: "teacher" } } } },
      select: { id: true, name: true, headline: true },
      take,
    }),
    canSeeStudents || teacherScope
      ? db.user.findMany({
          where: {
            OR: [{ name: contains }, { email: contains }],
            roles: { some: { role: { key: "student" } } },
            ...(canSeeStudents ? {} : { enrollments: { some: { course: { instructorId: user.id } } } }),
          },
          select: { id: true, name: true, email: true },
          take,
        })
      : Promise.resolve([]),
    db.discussionThread.findMany({
      where: { deletedAt: null, OR: [{ title: contains }, { body: contains }] },
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
