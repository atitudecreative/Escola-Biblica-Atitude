import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap, MessageSquare, Search } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { teacherCourseOptions, teacherStudents } from "@/server/services/teacher";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { formatNumber, pluralize, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Alunos" };

export default async function TeacherStudentsPage(props: PageProps<"/teacher/students">) {
  const user = await requirePermissionPage("students.view_own", "courses.manage_any");
  const sp = await props.searchParams;
  const q = strParam(sp, "q")?.trim() || undefined;
  const courseId = strParam(sp, "course") || undefined;
  const page = pageParam(sp);
  const [courses, data] = await Promise.all([teacherCourseOptions(user), teacherStudents(user, { q, courseId, page })]);
  const filtered = !!(q || courseId);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ensino", href: "/teacher" }, { label: "Alunos" }]}
        title="Alunos"
        description="Quem está estudando nos seus cursos, com progresso e último acesso."
      />

      {data.total === 0 && !filtered ? (
        <EmptyState
          icon={GraduationCap}
          title="Nenhum aluno ainda"
          description="Quando alguém se matricular em um dos seus cursos publicados, ele aparece aqui."
          action={
            <Button asChild variant="outline">
              <Link href="/teacher/courses">Ver meus cursos</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TableToolbar
              placeholder="Buscar por nome ou e-mail"
              filters={[{ name: "course", label: "Todos os cursos", options: courses.map((c) => ({ value: c.id, label: c.title })) }]}
            />
            <p className="text-small text-muted">
              {pluralize(data.total, "aluno", "alunos")}
              {data.inactive > 0 && <> · <span className="text-warning">{formatNumber(data.inactive)} sem acesso há 14+ dias</span></>}
            </p>
          </div>

          {data.rows.length === 0 ? (
            <EmptyState icon={Search} compact title="Nenhum aluno encontrado" description="Tente outro nome ou remova o filtro de curso." action={<Button variant="outline" asChild><Link href="/teacher/students">Limpar filtros</Link></Button>} />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
                <Table>
                  <THead>
                    <tr>
                      <TH>Aluno</TH>
                      <TH>{courseId ? "Curso" : "Cursos"}</TH>
                      <TH className="w-48">Progresso {courseId ? "" : "médio"}</TH>
                      <TH>Último acesso</TH>
                      <TH className="w-12"><span className="sr-only">Ações</span></TH>
                    </tr>
                  </THead>
                  <TBody>
                    {data.rows.map((r) => (
                      <TR key={r.user.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <Avatar name={r.user.name} src={r.user.avatarUrl} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.user.name}</p>
                              <p className="truncate text-caption text-subtle">{r.user.email}</p>
                            </div>
                          </div>
                        </TD>
                        <TD className="max-w-72">
                          <p className="truncate text-small">{r.courses.map((c) => c.title).join(", ")}</p>
                          {r.courses.length > 1 && <p className="text-caption text-subtle">{pluralize(r.courses.length, "curso", "cursos")} · {formatNumber(r.completed)} concluído(s)</p>}
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <Progress value={r.avgProgress} size="sm" className="w-24" tone={r.avgProgress >= 100 ? "success" : "primary"} label={`Progresso de ${r.user.name}`} />
                            <span className="text-caption text-muted tabular-nums">{r.avgProgress}%</span>
                          </div>
                        </TD>
                        <TD className={cn("text-small whitespace-nowrap", r.stale ? "text-warning" : "text-muted")}>
                          {r.lastAccess ? timeAgo(r.lastAccess) : "Nunca acessou"}
                        </TD>
                        <TD>
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Enviar mensagem para ${r.user.name}`}>
                            <Link href={`/messages?to=${r.user.id}`}><MessageSquare /></Link>
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>

              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface md:hidden">
                {data.rows.map((r) => (
                  <li key={r.user.id} className="flex items-center gap-3 p-3">
                    <Avatar name={r.user.name} src={r.user.avatarUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.user.name}</p>
                      <p className="truncate text-caption text-subtle">{r.courses.map((c) => c.title).join(", ")}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={r.avgProgress} size="sm" tone={r.avgProgress >= 100 ? "success" : "primary"} label={`Progresso de ${r.user.name}`} />
                        <span className="text-caption text-muted tabular-nums">{r.avgProgress}%</span>
                      </div>
                      <p className={cn("mt-0.5 text-caption", r.stale ? "text-warning" : "text-subtle")}>{r.lastAccess ? `Último acesso ${timeAgo(r.lastAccess)}` : "Nunca acessou"}</p>
                    </div>
                    <Button asChild variant="ghost" size="icon" aria-label={`Enviar mensagem para ${r.user.name}`}>
                      <Link href={`/messages?to=${r.user.id}`}><MessageSquare /></Link>
                    </Button>
                  </li>
                ))}
              </ul>
              <Pagination className="mt-4" page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={(p) => buildHref(sp, { page: p })} />
            </>
          )}
        </>
      )}
    </>
  );
}
