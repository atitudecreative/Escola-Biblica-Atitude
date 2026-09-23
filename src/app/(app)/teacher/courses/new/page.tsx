import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { PageHeader } from "@/components/ui/page-header";
import { NewCourseForm } from "@/components/teacher/new-course-form";

export const metadata: Metadata = { title: "Novo curso" };

export default async function NewCoursePage() {
  await requirePermissionPage("courses.create", "courses.manage_any");
  const categories = await db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ensino", href: "/teacher" }, { label: "Meus cursos", href: "/teacher/courses" }, { label: "Novo curso" }]}
        title="Novo curso"
        description="Comece pelo essencial. O curso nasce como rascunho e só fica visível para alunos depois de publicado."
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <NewCourseForm categories={categories} />
        </div>
        <aside className="text-small text-muted">
          <p className="mb-3 text-overline text-subtle">Próximos passos</p>
          <ol className="space-y-3">
            {[
              "Organize módulos e aulas no currículo",
              "Adicione vídeos, textos, materiais e avaliações",
              "Complete descrição, capa e objetivos",
              "Publique ou envie para revisão",
            ].map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-semibold text-muted tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
