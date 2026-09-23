import type { Metadata } from "next";
import { Download, Mail, ScrollText, Webhook } from "lucide-react";
import type { EmailStatus } from "@prisma/client";
import { requirePermissionPage } from "@/server/auth/guards";
import { auditFilterOptions, listAuditLogs, listEmails } from "@/server/services/admin-logs";
import { listWebhookDeliveries } from "@/server/services/admin-settings";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { FilterTabs } from "@/components/admin-config/filter-tabs";
import { DateRangeFilter } from "@/components/admin-config/logs/date-range";
import { EmailViewer } from "@/components/admin-config/logs/email-viewer";
import { DeliveryStatus } from "@/components/admin-config/settings/webhooks-manager";
import { auditActionLabel, auditTone, entityLabel } from "@/components/admin-config/audit-labels";
import { formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/labels";

export const metadata: Metadata = { title: "Logs · Administração" };
const PAGE_SIZE = 25;
type SP = Record<string, string | string[] | undefined>;

const EMAIL_STATUS: Record<EmailStatus, { label: string; tone: Tone }> = {
  LOGGED: { label: "Registrado", tone: "info" },
  QUEUED: { label: "Na fila", tone: "warning" },
  SENT: { label: "Enviado", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
};

export default async function LogsPage(props: PageProps<"/admin/logs">) {
  const user = await requirePermissionPage("audit.view");
  const sp = await props.searchParams;
  const tab = sp.tab === "emails" ? "emails" : sp.tab === "webhooks" ? "webhooks" : "audit";
  const canWebhooks = user.permissions.has("settings.manage") || user.permissions.has("audit.view");
  return (
    <>
      <PageHeader eyebrow="Administração" title="Logs" description="Trilha de auditoria das ações sensíveis, caixa de saída de e-mails e entregas de webhooks." />
      <FilterTabs
        className="mb-5"
        label="Tipo de log"
        items={[
          { label: "Auditoria", href: "/admin/logs", active: tab === "audit" },
          { label: "E-mails", href: "/admin/logs?tab=emails", active: tab === "emails" },
          ...(canWebhooks ? [{ label: "Webhooks", href: "/admin/logs?tab=webhooks", active: tab === "webhooks" }] : []),
        ]}
      />
      {tab === "audit" && <AuditTab sp={sp} />}
      {tab === "emails" && <EmailsTab sp={sp} />}
      {tab === "webhooks" && <WebhooksTab sp={sp} />}
    </>
  );
}

const toneDot: Record<string, string> = { danger: "bg-danger", warning: "bg-warning", success: "bg-success", neutral: "bg-border-strong" };

function Meta({ value }: { value: unknown }) {
  if (!value || (typeof value === "object" && !Object.keys(value as object).length)) return null;
  return (
    <details className="mt-1 text-caption">
      <summary className="cursor-pointer text-subtle select-none hover:text-fg">Detalhes</summary>
      <pre className="mt-1 max-w-md overflow-x-auto rounded-md bg-surface-2 p-2 font-mono text-[0.6875rem] whitespace-pre-wrap text-muted">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

async function AuditTab({ sp }: { sp: SP }) {
  const page = pageParam(sp);
  const f = { action: strParam(sp, "action"), actor: strParam(sp, "actor"), from: strParam(sp, "from"), to: strParam(sp, "to"), q: strParam(sp, "q") };
  const [{ total, rows }, opts] = await Promise.all([listAuditLogs({ ...f, page, pageSize: PAGE_SIZE }), auditFilterOptions()]);
  const prefixes = [...new Set(opts.actions.map((a) => a.split(".")[0]))];
  const exportQs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const filtered = Object.values(f).some(Boolean);
  return (
    <>
      <TableToolbar
        className="mb-4"
        placeholder="Ator, e-mail, IP ou ID"
        filters={[
          {
            name: "action",
            label: "Todas as ações",
            options: [
              ...prefixes.map((p) => ({ value: `${p}.*`, label: `${entityLabel(p)} (todas)` })),
              ...opts.actions.map((a) => ({ value: a, label: auditActionLabel(a) })),
            ],
          },
          { name: "actor", label: "Todos os atores", options: [{ value: "system", label: "Sistema / anônimo" }, ...opts.actors.map((a) => ({ value: a.id, label: a.name }))] },
        ]}
      >
        <Button variant="outline" asChild>
          <a href={`/api/admin/audit/export${exportQs ? `?${exportQs}` : ""}`} download>
            <Download /> Exportar CSV
          </a>
        </Button>
      </TableToolbar>
      <div className="mb-4">
        <DateRangeFilter />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title={filtered ? "Nenhum registro no filtro" : "Nenhum registro ainda"} description={filtered ? "Ajuste os filtros ou o período." : "Ações como login, alterações de configuração e publicações aparecem aqui."} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
            <Table>
              <THead>
                <tr>
                  <TH>Quando</TH>
                  <TH>Ator</TH>
                  <TH>Ação</TH>
                  <TH>Entidade</TH>
                  <TH>IP</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id} className="align-top">
                    <TD className="text-small whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</TD>
                    <TD>
                      {r.actor ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={r.actor.name} src={r.actor.avatarUrl} size="xs" />
                          <div className="min-w-0">
                            <p className="truncate text-small font-medium">{r.actor.name}</p>
                            <p className="truncate text-caption text-subtle">{r.actor.email}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-small text-subtle">Sistema</span>
                      )}
                    </TD>
                    <TD className="py-3">
                      <p className="flex items-center gap-2 text-sm">
                        <span className={`size-1.5 shrink-0 rounded-full ${toneDot[auditTone(r.action)]}`} aria-hidden />
                        {auditActionLabel(r.action)}
                      </p>
                      <p className="pl-3.5 font-mono text-caption text-subtle">{r.action}</p>
                      <div className="pl-3.5"><Meta value={r.metadata} /></div>
                    </TD>
                    <TD className="text-small">
                      <p>{entityLabel(r.entityType)}</p>
                      {r.entityId && <p className="max-w-40 truncate font-mono text-caption text-subtle" title={r.entityId}>{r.entityId}</p>}
                    </TD>
                    <TD className="font-mono text-caption text-muted">{r.ip ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-3 shadow-xs">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className={`size-1.5 shrink-0 rounded-full ${toneDot[auditTone(r.action)]}`} aria-hidden />
                  {auditActionLabel(r.action)}
                </p>
                <p className="mt-0.5 text-caption text-subtle">
                  {r.actor?.name ?? "Sistema"} · {formatDateTime(r.createdAt)}
                  {r.ip ? ` · ${r.ip}` : ""}
                </p>
                <Meta value={r.metadata} />
              </li>
            ))}
          </ul>
        </>
      )}
      <Pagination className="mt-5" page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => buildHref(sp, { page: p })} />
    </>
  );
}

async function EmailsTab({ sp }: { sp: SP }) {
  const page = pageParam(sp);
  const f = { q: strParam(sp, "q"), status: strParam(sp, "status"), template: strParam(sp, "template") };
  const { total, rows, templates } = await listEmails({ ...f, page, pageSize: PAGE_SIZE });
  const filtered = Object.values(f).some(Boolean);
  return (
    <>
      {env.EMAIL_PROVIDER === "log" && (
        <Alert tone="info" className="mb-4" title="Modo demonstração: e-mails não são enviados">
          O provedor ativo é <span className="font-mono">log</span>. As mensagens ficam registradas aqui — abra uma para ver o conteúdo, inclusive links de confirmação de conta e de redefinição de senha.
        </Alert>
      )}
      <TableToolbar
        className="mb-4"
        placeholder="Destinatário ou assunto"
        filters={[
          { name: "status", label: "Todos os status", options: Object.entries(EMAIL_STATUS).map(([k, v]) => ({ value: k, label: v.label })) },
          { name: "template", label: "Todos os modelos", options: templates.map((t) => ({ value: t, label: t })) },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Mail} title={filtered ? "Nenhum e-mail no filtro" : "Nenhum e-mail ainda"} description={filtered ? "Ajuste a busca ou os filtros." : "Cadastros, redefinições de senha, certificados e comunicados geram e-mails aqui."} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          <ul className="divide-y divide-border">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.subject}</p>
                  <p className="truncate text-caption text-subtle">
                    {m.to} · <span className="font-mono">{m.template}</span> · {m.provider} · {formatDateTime(m.createdAt)}
                  </p>
                  {m.error && <p className="truncate text-caption text-danger" title={m.error}>{m.error}</p>}
                </div>
                <Badge tone={EMAIL_STATUS[m.status].tone} dot className="hidden sm:inline-flex">{EMAIL_STATUS[m.status].label}</Badge>
                <EmailViewer id={m.id} subject={m.subject} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <Pagination className="mt-5" page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => buildHref(sp, { page: p })} />
    </>
  );
}

async function WebhooksTab({ sp }: { sp: SP }) {
  const page = pageParam(sp);
  const endpointId = strParam(sp, "endpoint");
  const status = strParam(sp, "status");
  const [{ total, rows }, endpoints] = await Promise.all([
    listWebhookDeliveries({ endpointId, status, page, pageSize: PAGE_SIZE }),
    db.webhookEndpoint.findMany({ select: { id: true, url: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <>
      <TableToolbar
        className="mb-4 [&>div:first-child]:hidden"
        filters={[
          { name: "status", label: "Todos os resultados", options: [{ value: "ok", label: "Sucesso (2xx)" }, { value: "fail", label: "Falhas" }] },
          { name: "endpoint", label: "Todos os endpoints", options: endpoints.map((e) => ({ value: e.id, label: e.url })) },
        ]}
      >
        <Button variant="outline" asChild>
          <a href="/admin/settings/integrations"><Webhook /> Gerenciar endpoints</a>
        </Button>
      </TableToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={Webhook} title="Nenhuma entrega" description="Cadastre um endpoint em Configurações › Integrações e use “Enviar teste”." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          <ul className="divide-y divide-border">
            {rows.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <DeliveryStatus statusCode={d.statusCode} error={d.error} />
                  <span className="font-mono text-small">{d.event}</span>
                  <span className="min-w-0 flex-1 truncate text-caption text-subtle">{d.endpoint.url}</span>
                  <span className="text-caption text-subtle">{formatDateTime(d.createdAt)}</span>
                </div>
                {d.error && <p className="mt-1 text-caption text-danger">{d.error}</p>}
                <Meta value={d.payload} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <Pagination className="mt-5" page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => buildHref(sp, { page: p })} />
    </>
  );
}
