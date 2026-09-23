import Link from "next/link";
import type { Metadata } from "next";
import { Award, GraduationCap, Search } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { certificateStats, eligibleEnrollments, listIssuedCertificates, listTemplates } from "@/server/services/admin-certificates";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatStrip } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { FilterTabs } from "@/components/admin-config/filter-tabs";
import { TemplatesManager } from "@/components/admin-config/certificates/templates-manager";
import { CertificateRowMenu, IssueButton } from "@/components/admin-config/certificates/issued-actions";
import { formatNumber, formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Certificados · Administração" };
const PAGE_SIZE = 20;

export default async function CertificatesPage(props: PageProps<"/admin/certificates">) {
  await requirePermissionPage("certificates.manage");
  const sp = await props.searchParams;
  const tab = sp.tab === "templates" ? "templates" : sp.tab === "issue" ? "issue" : "issued";
  const stats = await certificateStats();

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Certificados"
        description="Modelos usados na emissão, certificados emitidos, revogação e emissão manual."
      />
      <StatStrip
        className="mb-6"
        items={[
          { label: "Emitidos", value: formatNumber(stats.total) },
          { label: "Últimos 30 dias", value: formatNumber(stats.last30) },
          { label: "Revogados", value: formatNumber(stats.revoked) },
          { label: "Aguardando emissão", value: formatNumber(stats.eligible), hint: "Concluídos sem certificado" },
        ]}
      />
      <FilterTabs
        className="mb-6"
        label="Seções"
        items={[
          { label: "Emitidos", href: "/admin/certificates", active: tab === "issued" },
          { label: "Modelos", href: "/admin/certificates?tab=templates", active: tab === "templates" },
          { label: "Emitir manualmente", href: "/admin/certificates?tab=issue", active: tab === "issue", count: stats.eligible },
        ]}
      />
      {tab === "issued" && <IssuedTab sp={sp} />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "issue" && <IssueTab q={strParam(sp, "q")} />}
    </>
  );
}

async function IssuedTab({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const page = pageParam(sp);
  const f = { q: strParam(sp, "q"), status: strParam(sp, "status"), course: strParam(sp, "course"), page, pageSize: PAGE_SIZE };
  const { total, rows, courses } = await listIssuedCertificates(f);
  const filtered = !!(f.q || f.status || f.course);
  return (
    <>
      <TableToolbar
        className="mb-4"
        placeholder="Código, aluno, e-mail ou curso"
        filters={[
          { name: "status", label: "Todos os status", options: [{ value: "valid", label: "Válidos" }, { value: "revoked", label: "Revogados" }] },
          { name: "course", label: "Todos os cursos", options: courses.map((c) => ({ value: c.id, label: c.title })) },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={filtered ? Search : Award}
          title={filtered ? "Nenhum certificado encontrado" : "Nenhum certificado emitido"}
          description={filtered ? "Ajuste a busca ou os filtros." : "Os certificados aparecem aqui quando os alunos concluem cursos."}
          action={filtered ? <Button variant="outline" asChild><Link href="/admin/certificates">Limpar filtros</Link></Button> : undefined}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
            <Table>
              <THead>
                <tr>
                  <TH>Código</TH>
                  <TH>Aluno</TH>
                  <TH>Curso</TH>
                  <TH>Emitido</TH>
                  <TH>Status</TH>
                  <TH className="w-12"><span className="sr-only">Ações</span></TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-mono text-small whitespace-nowrap">{c.code}</TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.studentName} src={c.user.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.studentName}</p>
                          <p className="truncate text-caption text-subtle">{c.user.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="max-w-[16rem]">
                      <p className="truncate text-sm">{c.courseTitle}</p>
                      <p className="text-caption text-subtle">{c.workloadHours}h{c.template ? ` · ${c.template.name}` : ""}</p>
                    </TD>
                    <TD className="text-small whitespace-nowrap text-muted">{formatShortDate(c.issuedAt)}</TD>
                    <TD>
                      {c.revokedAt ? (
                        <span title={c.revokedReason ?? undefined}><Badge tone="danger" dot>Revogado</Badge></span>
                      ) : (
                        <Badge tone="success" dot>Válido</Badge>
                      )}
                    </TD>
                    <TD>
                      <CertificateRowMenu cert={{ id: c.id, code: c.code, studentName: c.studentName, revoked: !!c.revokedAt }} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="space-y-2 md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-xs">
                <Avatar name={c.studentName} src={c.user.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.studentName}</p>
                  <p className="truncate text-small text-muted">{c.courseTitle}</p>
                  <p className="mt-1 font-mono text-caption text-subtle">{c.code}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {c.revokedAt ? <Badge tone="danger" dot>Revogado</Badge> : <Badge tone="success" dot>Válido</Badge>}
                    <span className="text-caption text-subtle">{formatShortDate(c.issuedAt)}</span>
                  </div>
                  {c.revokedReason && <p className="mt-1 text-caption text-subtle">Motivo: {c.revokedReason}</p>}
                </div>
                <CertificateRowMenu cert={{ id: c.id, code: c.code, studentName: c.studentName, revoked: !!c.revokedAt }} />
              </li>
            ))}
          </ul>
        </>
      )}
      <Pagination className="mt-5" page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => buildHref(sp, { page: p })} />
    </>
  );
}

async function TemplatesTab() {
  const [templates, general] = await Promise.all([listTemplates(), getSettings("general")]);
  return (
    <TemplatesManager
      platformName={general.platformName}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        heading: t.heading,
        body: t.body,
        signatureName: t.signatureName,
        signatureRole: t.signatureRole,
        accentColor: t.accentColor,
        isDefault: t.isDefault,
        courses: t._count.courses,
        certificates: t._count.certificates,
      }))}
    />
  );
}

async function IssueTab({ q }: { q?: string }) {
  const [rows, courses] = await Promise.all([eligibleEnrollments(q), getSettings("courses")]);
  return (
    <div className="max-w-4xl">
      <Alert tone="info" className="mb-4" title="Quando usar">
        Matrículas concluídas que ainda não têm certificado — por exemplo, quando a emissão automática está
        {courses.autoIssueCertificates ? " ligada mas falhou, ou o aluno concluiu antes de ser ativada" : " desligada em Configurações › Cursos"}.
        A emissão notifica o aluno por e-mail e na plataforma.
      </Alert>
      <TableToolbar className="mb-4" placeholder="Buscar aluno ou curso" />
      {rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title={q ? "Nada encontrado" : "Tudo em dia"} description={q ? "Nenhuma matrícula concluída sem certificado corresponde à busca." : "Todas as matrículas concluídas já têm certificado."} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={e.user.name} src={e.user.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.user.name}</p>
                  <p className="truncate text-small text-muted">{e.course.title} · concluído em {formatShortDate(e.completedAt)}</p>
                  {!e.course.certificateEnabled && <p className="text-caption text-warning">Curso com certificado desativado</p>}
                </div>
              </div>
              <IssueButton enrollmentId={e.id} disabled={!e.course.certificateEnabled} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
