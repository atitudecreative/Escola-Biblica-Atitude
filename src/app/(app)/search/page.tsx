import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileText, GraduationCap, MessagesSquare, PlayCircle, Presentation, SearchX } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { globalSearch } from "@/server/services/search";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CatalogSearch } from "@/components/catalog/catalog-filters";

export const metadata: Metadata = { title: "Busca" };

const ICON = { courses: BookOpen, lessons: PlayCircle, materials: FileText, teachers: Presentation, students: GraduationCap, discussions: MessagesSquare };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const user = await requireUserPage();
  const groups = q.trim().length >= 2 ? await globalSearch(user, q, 20) : [];
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <>
      <PageHeader title="Busca" description={q ? `${total} resultado(s) para “${q}”` : "Procure por cursos, aulas, materiais, professores e discussões."} />
      <div className="mb-8 max-w-2xl"><CatalogSearch /></div>
      {q.trim().length < 2 ? null : total === 0 ? (
        <EmptyState icon={SearchX} title="Nada encontrado" description="Tente outras palavras ou termos mais curtos." />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {groups.map((g) => {
            const I = ICON[g.key];
            return (
              <section key={g.key}>
                <h2 className="mb-3 flex items-center gap-2 text-h4"><I className="size-4 text-subtle" /> {g.label} <span className="text-subtle">({g.items.length})</span></h2>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <Link href={it.href} className="block px-4 py-3 transition hover:bg-surface-2">
                        <p className="truncate text-sm font-medium">{it.title}</p>
                        {it.subtitle && <p className="truncate text-caption text-subtle">{it.subtitle}</p>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
