import Link from "next/link";
import type { Metadata } from "next";
import { Clock, ExternalLink, Layers, PencilLine, Star } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import {
  ADMIN_COURSES_PAGE_SIZE,
  adminCourseFilterOptions,
  courseReviewQueue,
  listAdminCourses,
} from "@/server/services/admin-courses";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { SortHeader, buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { BulkHeaderCheckbox, BulkSelectProvider, RowCheckbox } from "@/components/data/bulk-select";
import { CourseThumb } from "@/components/admin-config/course-thumb";
import { FilterTabs } from "@/components/admin-config/filter-tabs";
import { CourseRowMenu, CoursesBulkBar, ReviewActions } from "@/components/admin-config/courses/course-actions";
import { COURSE_STATUS } from "@/lib/labels";
import { formatNumber, formatShortDate, pluralize, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Cursos · Administração" };

export default async function AdminCoursesPage(props: PageProps<"/admin/courses">) {
  const user = await requirePermissionPage("courses.view_all", "courses.manage_any");
  const canManage = user.permissions.has("courses.manage_any");
  const sp = await props.searchParams;
  const filters = {
    q: strParam(sp, "q"),
    status: strParam(sp, "status"),
    category: strParam(sp, "category"),
    teacher: strParam(sp, "teacher"),
    featured: strParam(sp, "featured"),
    sort: strParam(sp, "sort"),
    dir: strParam(sp, "dir"),
    page: pageParam(sp),
  };
  const [{ total, rows }, queue, options] = await Promise.all([
    listAdminCourses(filters),
    courseReviewQueue(),
    adminCourseFilterOptions(),
  ]);
  const all = Object.values(options.byStatus).reduce((a, b) => a + (b ?? 0), 0);
  const teachers = options.teachers;
  const statusTabs = [
    { label: "Todos", value: undefined, count: all },
    { label: "Publicados", value: "PUBLISHED", count: options.byStatus.PUBLISHED ?? 0 },
    { label: "Em revisão", value: "REVIEW", count: options.byStatus.REVIEW ?? 0 },
    { label: "Rascunhos", value: "DRAFT", count: options.byStatus.DRAFT ?? 0 },
    { label: "Arquivados", value: "ARCHIVED", count: options.byStatus.ARCHIVED ?? 0 },
  ];
  const hasFilters = !!(filters.q || filters.category || filters.teacher || filters.featured || filters.status);

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Cursos"
        description="Todos os cursos da plataforma: revise o que foi enviado pelos professores, publique, arquive e escolha os destaques da home."
        actions={
          <Button variant="outline" asChild>
            <Link href="/courses" target="_blank">
              <ExternalLink /> Ver catálogo
            </Link>
          </Button>
        }
      />

      {queue.length > 0 && (
        <section aria-labelledby="review-queue" className="mb-8 overflow-hidden rounded-xl border border-warning/30 bg-surface shadow-xs">
          <div className="flex items-center gap-3 border-b border-warning/20 bg-warning-soft/60 px-4 py-3 sm:px-5">
            <Clock className="size-4 text-warning" aria-hidden />
            <h2 id="review-queue" className="text-sm font-semibold text-fg">
              Aguardando revisão
            </h2>
            <Badge tone="warning">{queue.length}</Badge>
            <p className="ml-auto hidden text-small text-muted sm:block">Aprovar publica o curso e avisa o professor.</p>
          </div>
          <ul className="divide-y divide-border">
            {queue.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CourseThumb title={c.title} src={c.coverUrl} className="w-24 shrink-0 rounded-md" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{c.title}</p>
                    <p className="mt-0.5 text-small text-muted">
                      {c.instructor.name} · enviado {timeAgo(c.submittedAt)}
                    </p>
                    <p className="text-caption text-subtle">
                      {pluralize(c._count.modules, "módulo", "módulos")} · {pluralize(c._count.lessons, "aula", "aulas")}
                      {c.category ? ` · ${c.category.name}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/teacher/courses/${c.id}`}>
                      <PencilLine /> Abrir no builder
                    </Link>
                  </Button>
                  {canManage && <ReviewActions course={{ id: c.id, title: c.title }} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FilterTabs
        className="mb-4"
        label="Filtrar por status"
        items={statusTabs.map((t) => ({
          label: t.label,
          count: t.count,
          active: (filters.status ?? undefined) === t.value,
          href: buildHref(sp, { status: t.value ?? null, page: null }),
        }))}
      />

      <TableToolbar
        className="mb-4"
        placeholder="Buscar por título ou slug"
        filters={[
          {
            name: "category",
            label: "Todas as categorias",
            options: [...options.categories.map((c) => ({ value: c.id, label: c.name })), { value: "none", label: "Sem categoria" }],
          },
          { name: "teacher", label: "Todos os professores", options: teachers.map((t) => ({ value: t.id, label: t.name })) },
          { name: "featured", label: "Destaque: todos", options: [{ value: "1", label: "Só destacados" }] },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={hasFilters ? "Nenhum curso encontrado" : "Nenhum curso ainda"}
          description={
            hasFilters ? "Ajuste a busca ou os filtros para ver outros cursos." : "Os cursos criados pelos professores aparecem aqui."
          }
          action={
            hasFilters ? (
              <Button variant="outline" asChild>
                <Link href="/admin/courses">Limpar filtros</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <BulkSelectProvider ids={canManage ? rows.map((r) => r.id) : []}>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
            <Table>
              <THead>
                <tr>
                  {canManage && (
                    <TH className="w-10">
                      <BulkHeaderCheckbox />
                    </TH>
                  )}
                  <SortHeader label="Curso" field="title" searchParams={sp} />
                  <TH>Professor</TH>
                  <TH>Status</TH>
                  <SortHeader label="Alunos" field="enrollments" searchParams={sp} className="text-right" />
                  <SortHeader label="Nota" field="rating" searchParams={sp} />
                  <SortHeader label="Atualizado" field="updated" searchParams={sp} />
                  {canManage && <TH className="w-12"><span className="sr-only">Ações</span></TH>}
                </tr>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    {canManage && (
                      <TD>
                        <RowCheckbox id={c.id} label={`Selecionar ${c.title}`} />
                      </TD>
                    )}
                    <TD className="max-w-[22rem]">
                      <div className="flex items-center gap-3">
                        <CourseThumb title={c.title} src={c.coverUrl} className="w-16 shrink-0 rounded" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/teacher/courses/${c.id}`} className="truncate font-medium text-fg hover:underline">
                              {c.title}
                            </Link>
                            {c.isFeatured && (
                              <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-label="Destaque na home" />
                            )}
                          </div>
                          <p className="truncate text-caption text-subtle">
                            {c.category?.name ?? "Sem categoria"} · {pluralize(c._count.lessons, "aula", "aulas")}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Avatar name={c.instructor.name} src={c.instructor.avatarUrl} size="xs" />
                        <span className="truncate text-small">{c.instructor.name}</span>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={COURSE_STATUS[c.status].tone} dot>
                        {COURSE_STATUS[c.status].label}
                      </Badge>
                    </TD>
                    <TD className="text-right tabular-nums">{formatNumber(c.enrollmentCount)}</TD>
                    <TD className="text-small tabular-nums text-muted">
                      {c.ratingCount ? `${formatNumber(c.ratingAvg, 1)} (${c.ratingCount})` : "—"}
                    </TD>
                    <TD className="text-small whitespace-nowrap text-muted">{formatShortDate(c.updatedAt)}</TD>
                    {canManage && (
                      <TD>
                        <CourseRowMenu
                          course={{ id: c.id, title: c.title, slug: c.slug, status: c.status, isFeatured: c.isFeatured, instructorId: c.instructor.id }}
                          teachers={teachers}
                        />
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Mobile */}
          <ul className="space-y-2 md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-surface p-3 shadow-xs">
                <div className="flex gap-3">
                  {canManage && (
                    <div className="pt-1">
                      <RowCheckbox id={c.id} label={`Selecionar ${c.title}`} />
                    </div>
                  )}
                  <CourseThumb title={c.title} src={c.coverUrl} className="w-20 shrink-0 self-start rounded" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/teacher/courses/${c.id}`} className="line-clamp-2 font-medium text-fg">
                      {c.title}
                    </Link>
                    <p className="mt-0.5 truncate text-caption text-subtle">{c.instructor.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={COURSE_STATUS[c.status].tone} dot>
                        {COURSE_STATUS[c.status].label}
                      </Badge>
                      {c.isFeatured && <Badge tone="accent">Destaque</Badge>}
                      <span className="text-caption text-subtle">{pluralize(c.enrollmentCount, "aluno", "alunos")}</span>
                    </div>
                  </div>
                  {canManage && (
                    <CourseRowMenu
                      course={{ id: c.id, title: c.title, slug: c.slug, status: c.status, isFeatured: c.isFeatured, instructorId: c.instructor.id }}
                      teachers={teachers}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>

          {canManage && <CoursesBulkBar />}
        </BulkSelectProvider>
      )}

      <Pagination
        className="mt-5"
        page={filters.page}
        pageSize={ADMIN_COURSES_PAGE_SIZE}
        total={total}
        hrefFor={(p) => buildHref(sp, { page: p })}
      />
    </>
  );
}
