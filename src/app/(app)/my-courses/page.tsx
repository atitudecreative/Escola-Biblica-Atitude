import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { PageHeader } from "@/components/ui/page-header";
import { CourseCard } from "@/components/course/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meus cursos" };

const TABS = [
  { key: "active", label: "Em andamento" },
  { key: "completed", label: "Concluídos" },
  { key: "all", label: "Todos" },
] as const;

export default async function MyCoursesPage({ searchParams }: PageProps<"/my-courses">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "active";
  const user = await requireUserPage();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: tab === "active" ? "ACTIVE" : tab === "completed" ? "COMPLETED" : { not: "CANCELLED" } },
    orderBy: [{ lastAccessedAt: { sort: "desc", nulls: "last" } }, { enrolledAt: "desc" }],
    include: {
      course: {
        select: {
          id: true, slug: true, title: true, coverUrl: true, level: true, durationMinutes: true, ratingAvg: true, ratingCount: true,
          category: { select: { name: true, position: true } }, instructor: { select: { name: true } },
        },
      },
    },
  });
  const counts = await db.enrollment.groupBy({ by: ["status"], where: { userId: user.id, status: { not: "CANCELLED" } }, _count: true });
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader title="Meus cursos" description="Acompanhe seu progresso e retome de onde parou." actions={<Button asChild variant="outline"><Link href="/courses">Explorar catálogo</Link></Button>} />
      <nav aria-label="Filtrar cursos" className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const n = t.key === "active" ? count("ACTIVE") : t.key === "completed" ? count("COMPLETED") : count("ACTIVE") + count("COMPLETED");
          return (
            <Link
              key={t.key}
              href={t.key === "active" ? "/my-courses" : `/my-courses?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex h-10 items-center gap-2 px-3 text-sm font-medium transition-colors",
                tab === t.key ? "text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary" : "text-muted hover:text-fg",
              )}
            >
              {t.label} <span className="rounded-full bg-surface-2 px-1.5 text-caption tabular-nums text-subtle">{n}</span>
            </Link>
          );
        })}
      </nav>
      {enrollments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={tab === "completed" ? "Nenhum curso concluído ainda" : "Você não tem cursos em andamento"}
          description={tab === "completed" ? "Quando concluir um curso, ele aparece aqui junto com seu certificado." : "Escolha um curso no catálogo para começar."}
          action={<Button asChild><Link href="/courses">Ver catálogo</Link></Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {enrollments.map((e) => (
            <CourseCard
              key={e.id}
              course={{ ...e.course, progress: e.progressPercent, completed: e.status === "COMPLETED" }}
              href={e.status === "COMPLETED" ? `/courses/${e.course.slug}` : `/learn/${e.courseId}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
