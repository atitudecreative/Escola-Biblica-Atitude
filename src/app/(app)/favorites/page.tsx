import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, FileText, Link2 } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listFavorites } from "@/server/services/favorites";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course/course-card";
import { LessonTypeIcon } from "@/components/course/lesson-type-icon";
import { FavoriteButton } from "@/components/course/course-actions";
import { LESSON_TYPE } from "@/lib/labels";
import { formatBytes, formatDuration } from "@/lib/format";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  const user = await requireUserPage();
  const favs = await listFavorites(user.id);
  const courses = favs.filter((f) => f.course && f.course.status === "PUBLISHED");
  const lessons = favs.filter((f) => f.lesson);
  const materials = favs.filter((f) => f.material);

  return (
    <>
      <PageHeader title="Meus favoritos" description="Cursos, aulas e materiais que você salvou para voltar depois." />
      {favs.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Você ainda não salvou nada"
          description="Use o ícone de marcador em cursos, aulas e materiais para guardá-los aqui."
          action={<Button asChild><Link href="/courses">Explorar cursos</Link></Button>}
        />
      ) : (
        <div className="space-y-10">
          {courses.length > 0 && (
            <section>
              <h2 className="mb-4 text-h3">Cursos</h2>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((f) => <CourseCard key={f.id} course={f.course!} />)}
              </div>
            </section>
          )}
          {lessons.length > 0 && (
            <section>
              <h2 className="mb-4 text-h3">Aulas</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {lessons.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <LessonTypeIcon type={f.lesson!.type} className="size-4 shrink-0 text-subtle" />
                    <Link href={`/learn/${f.lesson!.courseId}/${f.lesson!.id}`} className="min-w-0 flex-1 hover:text-primary">
                      <p className="truncate text-sm font-medium">{f.lesson!.title}</p>
                      <p className="truncate text-caption text-subtle">{f.lesson!.course.title} · {LESSON_TYPE[f.lesson!.type]} · {formatDuration(f.lesson!.durationSeconds)}</p>
                    </Link>
                    <FavoriteButton type="LESSON" id={f.lesson!.id} initial label={false} variant="ghost" />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {materials.length > 0 && (
            <section>
              <h2 className="mb-4 text-h3">Materiais</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {materials.map((f) => {
                  const m = f.material!;
                  const href = m.kind === "LINK" ? m.url ?? "#" : m.file ? `/api/files/${m.file.id}?download=1` : "#";
                  return (
                    <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                      {m.kind === "LINK" ? <Link2 className="size-4 shrink-0 text-subtle" /> : <FileText className="size-4 shrink-0 text-subtle" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.title}</p>
                        <p className="truncate text-caption text-subtle">{m.course.title}{m.file ? ` · ${formatBytes(m.file.sizeBytes)}` : ""}</p>
                      </div>
                      <FavoriteButton type="MATERIAL" id={m.id} initial label={false} variant="ghost" />
                      <Button asChild variant="outline" size="sm">
                        <a href={href} {...(m.kind === "LINK" ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>{m.kind === "LINK" ? "Abrir" : "Baixar"}</a>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
