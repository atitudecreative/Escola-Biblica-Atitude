import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { Avatar } from "@/components/ui/avatar";
import { CourseCard } from "@/components/course/course-card";
import { formatNumber, pluralize } from "@/lib/format";

async function load(id: string) {
  if (!/^[a-z0-9]{10,40}$/.test(id)) return null;
  return db.user.findFirst({
    where: { id, status: "ACTIVE", taughtCourses: { some: { status: "PUBLISHED" } } },
    select: {
      id: true, name: true, headline: true, bio: true, avatarUrl: true,
      taughtCourses: {
        where: { status: "PUBLISHED" },
        orderBy: { enrollmentCount: "desc" },
        select: { id: true, slug: true, title: true, coverUrl: true, level: true, durationMinutes: true, ratingAvg: true, ratingCount: true, enrollmentCount: true, category: { select: { name: true, position: true } }, instructor: { select: { name: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/teachers/[id]">): Promise<Metadata> {
  const t = await load((await params).id);
  return t ? { title: t.name, description: t.headline ?? t.bio ?? undefined } : { title: "Professor não encontrado" };
}

export default async function TeacherPage({ params }: PageProps<"/teachers/[id]">) {
  const t = await load((await params).id);
  if (!t) notFound();
  const students = t.taughtCourses.reduce((s, c) => s + c.enrollmentCount, 0);
  const rated = t.taughtCourses.filter((c) => c.ratingCount);
  const rating = rated.length ? rated.reduce((s, c) => s + c.ratingAvg, 0) / rated.length : null;
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6 border-b border-border pb-10 sm:flex-row sm:items-center">
        <Avatar name={t.name} src={t.avatarUrl} size="xl" className="size-24 text-[1.75rem]" />
        <div className="min-w-0">
          <p className="text-overline text-primary">Professor(a)</p>
          <h1 className="mt-1 font-display text-[2.25rem] leading-tight tracking-tight">{t.name}</h1>
          {t.headline && <p className="mt-1 text-muted">{t.headline}</p>}
          <p className="mt-3 text-small text-subtle">
            {pluralize(t.taughtCourses.length, "curso", "cursos")} · {pluralize(students, "aluno", "alunos")}
            {rating != null && ` · nota média ${formatNumber(rating, 1)}`}
          </p>
        </div>
      </header>
      {t.bio && <p className="mt-8 max-w-3xl text-[1.0625rem] leading-relaxed text-muted">{t.bio}</p>}
      <h2 className="mt-12 mb-5 text-h2">Cursos</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {t.taughtCourses.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </div>
  );
}
