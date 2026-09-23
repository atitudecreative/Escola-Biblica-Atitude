import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { JOINED_OPTIONS, PAGE_SIZE, PROGRESS_BANDS, courseOptions, listStudents, type StudentRow } from "@/server/services/users-admin";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { SortHeader, buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { BulkHeaderCheckbox, BulkSelectProvider, RowCheckbox } from "@/components/data/bulk-select";
import { UserRowMenu, UsersBulkBar } from "@/components/admin/people/user-actions";
import { EnrollDialogButton } from "@/components/admin/people/enrollment-actions";
import { USER_STATUS } from "@/lib/labels";
import { formatDuration, formatNumber, formatShortDate, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Alunos" };

export default async function StudentsPage(props: PageProps<"/admin/students">) {
  const me = await requirePermissionPage("students.view_all", "users.view");
  const sp = await props.searchParams;
  const canManage = me.permissions.has("users.manage");
  const canEnroll = me.permissions.has("enrollments.manage");
  const canGrantAdmin = me.permissions.has("roles.manage");
  const params = {
    q: strParam(sp, "q"),
    status: strParam(sp, "status"),
    course: strParam(sp, "course"),
    progress: strParam(sp, "progress"),
    joined: strParam(sp, "joined"),
    sort: strParam(sp, "sort"),
    dir: strParam(sp, "dir"),
    page: pageParam(sp),
  };
  const [{ rows, total }, courses] = await Promise.all([listStudents(params), courseOptions()]);
  const filtered = !!(params.q || params.status || params.course || params.progress || params.joined);
  const editable = (u: StudentRow) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, headline: u.headline, status: u.status, roles: u.roles });
  const actions = (u: StudentRow) => (
    <div className="flex items-center justify-end gap-1">
      {canEnroll && <EnrollDialogButton student={{ id: u.id, name: u.name }} courses={courses} size="sm" variant="ghost" />}
      <UserRowMenu user={editable(u)} canManage={canManage} canGrantAdmin={canGrantAdmin} isSelf={u.id === me.id} profileHref={`/admin/students/${u.id}`} messageHref={`/messages?to=${u.id}`} />
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow={canManage ? "Administração" : "Gestão"}
        title="Alunos"
        description="Acompanhe quem está estudando, o progresso de cada aluno e aja rápido: matricular, redefinir senha ou bloquear."
        actions={
          me.permissions.has("reports.export") && (
            <Button variant="outline" asChild>
              <Link href="/manager/reports?type=students">Relatório de alunos</Link>
            </Button>
          )
        }
      />

      <TableToolbar
        className="mb-4"
        placeholder="Buscar por nome ou e-mail"
        filters={[
          { name: "status", label: "Todos os status", options: (["ACTIVE", "INACTIVE", "BLOCKED"] as const).map((s) => ({ value: s, label: USER_STATUS[s].label })) },
          { name: "course", label: "Todos os cursos", options: courses.map((c) => ({ value: c.id, label: c.title })) },
          { name: "progress", label: "Qualquer progresso", options: PROGRESS_BANDS.map((b) => ({ value: b.value, label: `Progresso ${b.label}` })) },
          { name: "joined", label: "Cadastro: qualquer data", options: JOINED_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
        ]}
      />

      <p className="mb-3 text-small text-muted">
        <span className="font-medium text-fg tabular-nums">{formatNumber(total)}</span> {total === 1 ? "aluno" : "alunos"}
        {filtered ? " com esses filtros" : ""}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={filtered ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
          description={filtered ? "Ajuste a busca ou os filtros para ver outros alunos." : "Os alunos aparecem aqui ao criar a conta."}
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/admin/students">Limpar filtros</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <BulkSelectProvider ids={canManage ? rows.map((r) => r.id) : []}>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
            <Table>
              <THead>
                <tr>
                  {canManage && (
                    <TH className="w-10">
                      <BulkHeaderCheckbox />
                    </TH>
                  )}
                  <SortHeader label="Aluno" field="name" searchParams={sp} />
                  <TH className="text-right">Cursos</TH>
                  <TH className="w-40">Progresso médio</TH>
                  <TH>Status</TH>
                  <SortHeader label="Último acesso" field="lastSeenAt" searchParams={sp} />
                  <SortHeader label="Cadastro" field="createdAt" searchParams={sp} className="hidden xl:table-cell" />
                  <TH className="w-12">
                    <span className="sr-only">Ações</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((u) => (
                  <TR key={u.id}>
                    {canManage && (
                      <TD>
                        <RowCheckbox id={u.id} label={`Selecionar ${u.name}`} />
                      </TD>
                    )}
                    <TD className="max-w-[18rem]">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/admin/students/${u.id}`} className="block truncate font-medium text-fg hover:underline">{u.name}</Link>
                          <p className="truncate text-caption text-muted">{u.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {u.courses}
                      {u.completed > 0 && <span className="block text-caption text-subtle">{u.completed} concluído(s)</span>}
                    </TD>
                    <TD>
                      {u.courses ? (
                        <div className="flex items-center gap-2">
                          <Progress value={u.avgProgress} size="sm" className="w-20" label={`Progresso médio de ${u.name}`} />
                          <span className="text-small tabular-nums">{u.avgProgress}%</span>
                        </div>
                      ) : (
                        <span className="text-small text-subtle">Sem cursos</span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={USER_STATUS[u.status].tone} dot>{USER_STATUS[u.status].label}</Badge>
                    </TD>
                    <TD className="text-small whitespace-nowrap text-muted">
                      {timeAgo(u.lastAccess)}
                      {u.seconds > 0 && <span className="block text-caption text-subtle">{formatDuration(u.seconds)} de estudo</span>}
                    </TD>
                    <TD className="hidden text-small whitespace-nowrap text-muted xl:table-cell">{formatShortDate(u.createdAt)}</TD>
                    <TD>{actions(u)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:hidden">
            {rows.map((u) => (
              <li key={u.id} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <Avatar name={u.name} src={u.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/students/${u.id}`} className="block truncate font-medium text-fg">{u.name}</Link>
                    <p className="truncate text-caption text-muted">{u.email}</p>
                  </div>
                  <UserRowMenu user={editable(u)} canManage={canManage} canGrantAdmin={canGrantAdmin} isSelf={u.id === me.id} profileHref={`/admin/students/${u.id}`} messageHref={`/messages?to=${u.id}`} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={u.avgProgress} size="sm" className="flex-1" label={`Progresso médio de ${u.name}`} />
                  <span className="text-small tabular-nums">{u.avgProgress}%</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
                  <Badge tone={USER_STATUS[u.status].tone} dot>{USER_STATUS[u.status].label}</Badge>
                  <span>{u.courses} curso(s)</span>
                  <span>Acesso {timeAgo(u.lastAccess)}</span>
                </div>
                {canEnroll && (
                  <div className="mt-2">
                    <EnrollDialogButton student={{ id: u.id, name: u.name }} courses={courses} size="sm" variant="outline" />
                  </div>
                )}
              </li>
            ))}
          </ul>

          <Pagination className="mt-4" page={params.page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => buildHref(sp, { page: p })} />
          {canManage && <UsersBulkBar canManage={canManage} canExport={me.permissions.has("reports.export")} />}
        </BulkSelectProvider>
      )}
    </>
  );
}
