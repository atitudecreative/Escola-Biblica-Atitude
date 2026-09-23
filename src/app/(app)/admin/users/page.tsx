import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { JOINED_OPTIONS, PAGE_SIZE, listUsers, type UserRow } from "@/server/services/users-admin";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { SortHeader, buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { BulkHeaderCheckbox, BulkSelectProvider, RowCheckbox } from "@/components/data/bulk-select";
import { CreateUserButton, UserRowMenu, UsersBulkBar } from "@/components/admin/people/user-actions";
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { USER_STATUS } from "@/lib/labels";
import { formatNumber, formatShortDate, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Usuários · Administração" };

const ROLE_TONE: Record<RoleKey, "neutral" | "primary" | "accent" | "info"> = { student: "neutral", teacher: "primary", manager: "info", admin: "accent" };

function profileHref(u: UserRow) {
  if (u.roles.includes("teacher")) return `/admin/teachers/${u.id}`;
  if (u.roles.length === 1 && u.roles[0] === "student") return `/admin/students/${u.id}`;
  return undefined;
}

export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const me = await requirePermissionPage("users.view", "users.manage");
  const sp = await props.searchParams;
  const canManage = me.permissions.has("users.manage");
  const canGrantAdmin = me.permissions.has("roles.manage");
  const canExport = me.permissions.has("reports.export");
  const params = {
    q: strParam(sp, "q"),
    role: strParam(sp, "role"),
    status: strParam(sp, "status"),
    joined: strParam(sp, "joined"),
    sort: strParam(sp, "sort"),
    dir: strParam(sp, "dir"),
    page: pageParam(sp),
  };
  const { rows, total, statusCounts } = await listUsers(params);
  const filtered = !!(params.q || params.role || params.status || params.joined);
  const editable = (u: UserRow) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, headline: u.headline, status: u.status, roles: u.roles });
  const menu = (u: UserRow) => (
    <UserRowMenu user={editable(u)} canManage={canManage} canGrantAdmin={canGrantAdmin} isSelf={u.id === me.id} profileHref={profileHref(u)} messageHref={u.id !== me.id ? `/messages?to=${u.id}` : undefined} />
  );

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description="Todas as contas da plataforma. Crie acessos, ajuste perfis, redefina senhas e bloqueie contas quando necessário."
        actions={canManage && <CreateUserButton canGrantAdmin={canGrantAdmin} />}
      />

      <p className="mb-4 text-small text-muted">
        {(["ACTIVE", "INACTIVE", "BLOCKED"] as const).map((s, i) => (
          <span key={s}>
            {i > 0 && <span className="mx-2 text-subtle">·</span>}
            <Link href={buildHref(sp, { status: params.status === s ? null : s, page: null })} className={params.status === s ? "font-medium text-fg underline underline-offset-4" : "hover:text-fg"}>
              <span className="font-medium text-fg tabular-nums">{formatNumber(statusCounts[s] ?? 0)}</span> {USER_STATUS[s].label.toLowerCase()}s
            </Link>
          </span>
        ))}
      </p>

      <TableToolbar
        className="mb-4"
        placeholder="Buscar por nome ou e-mail"
        filters={[
          { name: "role", label: "Todos os perfis", options: ROLE_KEYS.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
          { name: "status", label: "Todos os status", options: (["ACTIVE", "INACTIVE", "BLOCKED"] as const).map((s) => ({ value: s, label: USER_STATUS[s].label })) },
          { name: "joined", label: "Cadastro: qualquer data", options: JOINED_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "Nenhuma conta encontrada" : "Nenhuma conta ainda"}
          description={filtered ? "Ajuste a busca ou os filtros." : "Crie a primeira conta para começar."}
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/admin/users">Limpar filtros</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <BulkSelectProvider ids={rows.map((r) => r.id)}>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
            <Table>
              <THead>
                <tr>
                  <TH className="w-10">
                    <BulkHeaderCheckbox />
                  </TH>
                  <SortHeader label="Usuário" field="name" searchParams={sp} />
                  <TH>Perfis</TH>
                  <TH>Status</TH>
                  <SortHeader label="Último acesso" field="lastSeenAt" searchParams={sp} />
                  <SortHeader label="Cadastro" field="createdAt" searchParams={sp} />
                  <TH className="w-12">
                    <span className="sr-only">Ações</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((u) => {
                  const href = profileHref(u);
                  return (
                    <TR key={u.id}>
                      <TD>
                        <RowCheckbox id={u.id} label={`Selecionar ${u.name}`} />
                      </TD>
                      <TD className="max-w-[20rem]">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                          <div className="min-w-0">
                            {href ? (
                              <Link href={href} className="block truncate font-medium text-fg hover:underline">{u.name}</Link>
                            ) : (
                              <p className="truncate font-medium text-fg">{u.name}</p>
                            )}
                            <p className="truncate text-caption text-muted">
                              {u.email}
                              {!u.emailVerifiedAt && <span className="text-warning"> · e-mail não confirmado</span>}
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r} tone={ROLE_TONE[r]}>{ROLE_LABELS[r]}</Badge>
                          ))}
                        </div>
                      </TD>
                      <TD>
                        <Badge tone={USER_STATUS[u.status].tone} dot>{USER_STATUS[u.status].label}</Badge>
                      </TD>
                      <TD className="text-small whitespace-nowrap text-muted">{timeAgo(u.lastSeenAt)}</TD>
                      <TD className="text-small whitespace-nowrap text-muted">{formatShortDate(u.createdAt)}</TD>
                      <TD>{menu(u)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:hidden">
            {rows.map((u) => (
              <li key={u.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="pt-2.5">
                  <RowCheckbox id={u.id} label={`Selecionar ${u.name}`} />
                </div>
                <Avatar name={u.name} src={u.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{u.name}</p>
                  <p className="truncate text-caption text-muted">{u.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Badge tone={USER_STATUS[u.status].tone} dot>{USER_STATUS[u.status].label}</Badge>
                    {u.roles.map((r) => (
                      <Badge key={r} tone={ROLE_TONE[r]}>{ROLE_LABELS[r]}</Badge>
                    ))}
                  </div>
                  <p className="mt-1.5 text-caption text-subtle">Último acesso {timeAgo(u.lastSeenAt)} · desde {formatShortDate(u.createdAt)}</p>
                </div>
                <div className="-mr-1">{menu(u)}</div>
              </li>
            ))}
          </ul>

          <Pagination className="mt-4" page={params.page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => buildHref(sp, { page: p })} />
          <UsersBulkBar canManage={canManage} canExport={canExport} />
        </BulkSelectProvider>
      )}
    </>
  );
}
