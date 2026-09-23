import Link from "next/link";
import type { Metadata } from "next";
import { BookPlus, Layers, Search } from "lucide-react";
import type { CourseStatus } from "@prisma/client";
import { requirePermissionPage } from "@/server/auth/guards";
import { teacherCourses } from "@/server/services/teacher";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { buildHref, strParam } from "@/components/data/sort-header";
import { CourseCover } from "@/components/course/course-cover";
import { COURSE_STATUS } from "@/lib/labels";
import { formatNumber, pluralize, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meus cursos" };

const STATUSES: CourseStatus[] = ["PUBLISHED", "DRAFT", "REVIEW", "ARCHIVED"];

export default async function TeacherCoursesPage(props: PageProps<"/teacher/courses">) {
  const user = await requirePermissionPage("courses.manage_own", "courses.create", "courses.manage_any");
  const sp = await props.searchParams;
  const statusParam = strParam(sp, "status");
  const status = STATUSES.includes(statusParam as CourseStatus) ? (statusParam as CourseStatus) : undefined;
  const q = strParam(sp, "q")?.trim() || undefined;
  const { courses, counts, total } = await teacherCourses(user, { status, q });
  const all = user.permissions.has("courses.manage_any");

  const tabs: { label: string; value?: CourseStatus; count: number }[] = [
    { label: "Todos", count: total },
    ...STATUSES.map((s) => ({ label: s === "DRAFT" ? "Rascunhos" : s === "PUBLISHED" ? "Publicados" : s === "REVIEW" ? "Em revisão" : "Arquivados", value: s, count: counts[s] ?? 0 })),
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ensino", href: "/teacher" }, { label: "Meus cursos" }]}
        title={all ? "Cursos" : "Meus cursos"}
        description={all ? "Todos os cursos da escola. Como administrador, você pode editar qualquer um." : "Crie, organize e publique seus cursos."}
        actions={
          <Button asChild>
            <Link href="/teacher/courses/new">
              <BookPlus /> Novo curso
            </Link>
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={Layers}
          title="Você ainda não tem cursos"
          description="Comece com um título. Depois você organiza módulos, aulas e avaliações no editor do curso."
          action={
            <Button asChild>
              <Link href="/teacher/courses/new">Criar primeiro curso</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Filtrar por status" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <ul className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
                {tabs.map((t) => {
                  const active = t.value === status;
                  return (
                    <li key={t.label}>
                      <Link
                        href={buildHref(sp, { status: t.value ?? null, page: null })}
                        aria-current={active ? "page" : undefined}
                        scroll={false}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-small font-medium whitespace-nowrap transition-all",
                          active ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
                        )}
                      >
                        {t.label}
                        <span className={cn("tabular-nums", active ? "text-muted" : "text-subtle")}>{t.count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <TableToolbar placeholder="Buscar curso pelo título" />
          </div>

          {courses.length === 0 ? (
            <EmptyState
              icon={Search}
              compact
              title="Nenhum curso encontrado"
              description={q ? `Nada corresponde a “${q}” com os filtros atuais.` : "Não há cursos com este status."}
              action={
                <Button variant="outline" asChild>
                  <Link href="/teacher/courses">Ver todos os cursos</Link>
                </Button>
              }
            />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
                <Table>
                  <THead>
                    <tr>
                      <TH>Curso</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Alunos</TH>
                      <TH className="w-44">Progresso médio</TH>
                      <TH className="text-right">Aulas</TH>
                      <TH>Atualizado</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {courses.map((c) => (
                      <TR key={c.id} className="group relative">
                        <TD className="py-3">
                          <div className="flex items-center gap-3">
                            <CourseCover title={c.title} src={c.coverUrl} size="sm" className="w-20 shrink-0 rounded-md" />
                            <div className="min-w-0">
                              <Link href={`/teacher/courses/${c.id}`} className="line-clamp-1 font-medium text-fg after:absolute after:inset-0 group-hover:text-primary">
                                {c.title}
                              </Link>
                              <p className="line-clamp-1 text-caption text-subtle">
                                {c.category?.name ?? "Sem categoria"}
                                {all && c.instructorId !== user.id ? ` · ${c.instructor.name}` : ""}
                              </p>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <Badge tone={COURSE_STATUS[c.status].tone} dot>
                            {COURSE_STATUS[c.status].label}
                          </Badge>
                        </TD>
                        <TD className="text-right tabular-nums">{formatNumber(c.students)}</TD>
                        <TD>
                          {c.students ? (
                            <div className="flex items-center gap-2">
                              <Progress value={c.avgProgress} size="sm" className="w-24" label={`Progresso médio de ${c.title}`} />
                              <span className="text-caption text-muted tabular-nums">{c.avgProgress}%</span>
                            </div>
                          ) : (
                            <span className="text-caption text-subtle">—</span>
                          )}
                        </TD>
                        <TD className="text-right tabular-nums">{formatNumber(c._count.lessons)}</TD>
                        <TD className="text-small whitespace-nowrap text-muted">{timeAgo(c.updatedAt)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>

              {/* Mobile */}
              <ul className="flex flex-col gap-3 md:hidden">
                {courses.map((c) => (
                  <li key={c.id}>
                    <Link href={`/teacher/courses/${c.id}`} className="flex gap-3 rounded-xl border border-border bg-surface p-3 shadow-xs active:bg-surface-2">
                      <CourseCover title={c.title} src={c.coverUrl} size="sm" className="w-24 shrink-0 self-start rounded-md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-medium text-fg">{c.title}</p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Badge tone={COURSE_STATUS[c.status].tone} dot>
                            {COURSE_STATUS[c.status].label}
                          </Badge>
                          <span className="text-caption text-subtle">
                            {pluralize(c.students, "aluno", "alunos")} · {pluralize(c._count.lessons, "aula", "aulas")}
                          </span>
                        </div>
                        {c.students > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <Progress value={c.avgProgress} size="sm" label={`Progresso médio de ${c.title}`} />
                            <span className="text-caption text-muted tabular-nums">{c.avgProgress}%</span>
                          </div>
                        )}
                        <p className="mt-1.5 text-caption text-subtle">Atualizado {timeAgo(c.updatedAt)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
