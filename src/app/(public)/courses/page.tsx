import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { catalogFacets, DURATION_BUCKETS, enrollmentMap, listCatalog, PAGE_SIZE, withProgress, type CatalogFilters } from "@/server/services/catalog";
import { CourseCard } from "@/components/course/course-card";
import { CatalogSearch, CatalogSidebar, CatalogSort, MobileFilters, type FacetData } from "@/components/catalog/catalog-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { COURSE_LEVEL } from "@/lib/labels";
import { formatNumber, pluralize } from "@/lib/format";
import type { CourseLevel } from "@prisma/client";

export const metadata: Metadata = {
  title: "Catálogo de cursos",
  description: "Cursos de Bíblia, teologia, liderança, família e discipulado. Estude no seu ritmo, com certificado.",
  alternates: { canonical: "/courses" },
};

export default async function CatalogPage({ searchParams }: PageProps<"/courses">) {
  const sp = await searchParams;
  const level = strParam(sp, "level");
  const duration = strParam(sp, "duration");
  const sort = strParam(sp, "sort");
  const filters: CatalogFilters = {
    q: strParam(sp, "q")?.slice(0, 100),
    category: strParam(sp, "category"),
    level: level && level in COURSE_LEVEL ? (level as CourseLevel) : undefined,
    duration: duration && duration in DURATION_BUCKETS ? (duration as keyof typeof DURATION_BUCKETS) : undefined,
    teacher: strParam(sp, "teacher"),
    rating: Number(strParam(sp, "rating")) || undefined,
    sort: (["popular", "newest", "rating", "title"] as const).find((s) => s === sort),
    page: pageParam(sp),
  };
  const [user, facets, result] = await Promise.all([getSessionUser(), catalogFacets(), listCatalog(filters)]);
  const map = await enrollmentMap(user?.id, result.items.map((c) => c.id));
  const courses = withProgress(result.items, map);

  const facetData: FacetData = {
    categories: facets.categories.filter((c) => c._count.courses > 0).map((c) => ({ value: c.slug, label: c.name, count: c._count.courses })),
    levels: Object.entries(COURSE_LEVEL).map(([value, label]) => ({ value, label })),
    durations: Object.entries(DURATION_BUCKETS).map(([value, d]) => ({ value, label: d.label })),
    teachers: facets.teachers.map((t) => ({ value: t.id, label: t.name })),
  };
  const activeCount = ["category", "level", "duration", "teacher", "rating"].filter((k) => strParam(sp, k)).length;
  const category = facets.categories.find((c) => c.slug === filters.category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-8 max-w-2xl">
        <p className="text-overline text-primary">Catálogo</p>
        <h1 className="mt-2 font-display text-[2.5rem] leading-tight tracking-tight">{category ? category.name : "Todos os cursos"}</h1>
        <p className="mt-2 text-muted">{category?.description ?? "Formação bíblica e ministerial para cada fase da sua caminhada. Gratuito e com certificado."}</p>
      </header>

      <div className="mb-8 flex flex-col gap-2 sm:flex-row">
        <CatalogSearch />
        <div className="flex gap-2">
          <MobileFilters facets={facetData} activeCount={activeCount} />
          <CatalogSort />
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CatalogSidebar facets={facetData} />
        <section aria-live="polite" aria-label="Resultados">
          <p className="mb-4 text-small text-muted">
            {pluralize(result.total, "curso encontrado", "cursos encontrados")}
            {filters.q && (
              <>
                {" "}para <strong className="text-fg">“{filters.q}”</strong>
              </>
            )}
          </p>
          {courses.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nenhum curso encontrado"
              description="Tente outros termos ou remova alguns filtros para ver mais resultados."
              action={
                <Button asChild variant="outline">
                  <Link href="/courses">Limpar busca e filtros</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          )}
          <Pagination
            className="mt-10"
            page={result.page}
            pageSize={PAGE_SIZE}
            total={result.total}
            hrefFor={(p) => `/courses${buildHref(sp, { page: p > 1 ? p : null })}`}
          />
          {result.total > 0 && <p className="sr-only">Página {formatNumber(result.page)}</p>}
        </section>
      </div>
    </div>
  );
}
