import Link from "next/link";
import type { Metadata } from "next";
import { Presentation } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { PAGE_SIZE, listTeachers, type TeacherRow } from "@/server/services/users-admin";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { SortHeader, buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { UserRowMenu } from "@/components/admin/people/user-actions";
import { USER_STATUS } from "@/lib/labels";
import { formatNumber, formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Professores" };

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

export default async function TeachersPage(props: PageProps<"/admin/teachers">) {
  const me = await requirePermissionPage("users.view", "students.view_all");
  const sp = await props.searchParams;
  const canManage = me.permissions.has("users.manage");
  const params = { q: strParam(sp, "q"), status: strParam(sp, "status"), sort: strParam(sp, "sort"), dir: strParam(sp, "dir"), page: pageParam(sp) };
  const { rows, total } = await listTeachers(params);
  const filtered = !!(params.q || params.status);
  const menu = (t: TeacherRow) => (
    <UserRowMenu
      user={{ id: t.id, name: t.name, email: t.email, phone: t.phone, headline: t.headline, status: t.status, roles: t.roles }}
      canManage={canManage}
      canGrantAdmin={me.permissions.has("roles.manage")}
      isSelf={t.id === me.id}
      profileHref={`/admin/teachers/${t.id}`}
      messageHref={t.id !== me.id ? `/messages?to=${t.id}` : undefined}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow={canManage ? "Administração" : "Gestão"}
        title="Professores"
        description="Cursos, alunos e resultados de cada professor. Conclusão e notas consideram todas as turmas dos cursos dele."
        actions={
          me.permissions.has("reports.view") && (
            <Button variant="outline" asChild>
              <Link href="/manager/reports?type=teachers">Relatório de professores</Link>
            </Button>
          )
        }
      />

      <TableToolbar
        className="mb-4"
        placeholder="Buscar por nome ou e-mail"
        filters={[{ name: "status", label: "Todos os status", options: (["ACTIVE", "INACTIVE", "BLOCKED"] as const).map((s) => ({ value: s, label: USER_STATUS[s].label })) }]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title={filtered ? "Nenhum professor encontrado" : "Nenhum professor cadastrado"}
          description={filtered ? "Ajuste a busca ou os filtros." : "Dê o perfil Professor a uma conta em Usuários."}
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/admin/teachers">Limpar filtros</Link>
              </Button>
            ) : canManage ? (
              <Button asChild>
                <Link href="/admin/users">Ir para usuários</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
            <Table>
              <THead>
                <tr>
                  <SortHeader label="Professor" field="name" searchParams={sp} />
                  <TH className="text-right">Cursos</TH>
                  <TH className="text-right">Alunos</TH>
                  <TH className="text-right">Conclusão</TH>
                  <TH className="text-right">Nota média</TH>
                  <TH className="text-right">Correções pendentes</TH>
                  <TH>Status</TH>
                  <SortHeader label="Cadastro" field="createdAt" searchParams={sp} className="hidden xl:table-cell" />
                  <TH className="w-12"><span className="sr-only">Ações</span></TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((t) => (
                  <TR key={t.id}>
                    <TD className="max-w-[18rem]">
                      <div className="flex items-center gap-3">
                        <Avatar name={t.name} src={t.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/admin/teachers/${t.id}`} className="block truncate font-medium text-fg hover:underline">{t.name}</Link>
                          <p className="truncate text-caption text-muted">{t.headline ?? t.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {t.courses}
                      <span className="block text-caption text-subtle">{t.published} publicados</span>
                    </TD>
                    <TD className="text-right tabular-nums">{formatNumber(t.students)}</TD>
                    <TD className="text-right tabular-nums">{pct(t.completionRate)}</TD>
                    <TD className="text-right tabular-nums">{pct(t.avgQuizScore)}</TD>
                    <TD className="text-right tabular-nums">{t.pending ? <Badge tone="warning">{t.pending}</Badge> : <span className="text-subtle">0</span>}</TD>
                    <TD><Badge tone={USER_STATUS[t.status].tone} dot>{USER_STATUS[t.status].label}</Badge></TD>
                    <TD className="hidden text-small whitespace-nowrap text-muted xl:table-cell">{formatShortDate(t.createdAt)}</TD>
                    <TD>{menu(t)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:hidden">
            {rows.map((t) => (
              <li key={t.id} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <Avatar name={t.name} src={t.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/teachers/${t.id}`} className="block truncate font-medium text-fg">{t.name}</Link>
                    <p className="truncate text-caption text-muted">{t.headline ?? t.email}</p>
                  </div>
                  {menu(t)}
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["Cursos", String(t.courses)],
                    ["Alunos", formatNumber(t.students)],
                    ["Conclusão", pct(t.completionRate)],
                    ["Nota", pct(t.avgQuizScore)],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-surface-2 py-2">
                      <dt className="text-caption text-subtle">{l}</dt>
                      <dd className="text-sm font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <Pagination className="mt-4" page={params.page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => buildHref(sp, { page: p })} />
        </>
      )}
    </>
  );
}
