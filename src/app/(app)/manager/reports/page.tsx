import Link from "next/link";
import type { Metadata } from "next";
import { Download, FileSpreadsheet, SearchX } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { REPORTS, REPORT_PAGE_SIZE, getReportDef, runReport } from "@/server/services/reports";
import { courseOptions } from "@/server/services/users-admin";
import { parsePeriod, periodQuery, PERIOD_LABELS } from "@/lib/analytics-period";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { TableToolbar, type ToolbarFilter } from "@/components/data/table-toolbar";
import { buildHref, pageParam, strParam } from "@/components/data/sort-header";
import { PeriodFilter } from "@/components/analytics/period-filter";
import { PrintButton, PrintStyles } from "@/components/analytics/print-button";
import { ReportChartView } from "@/components/analytics/report-chart";
import { ReportTable } from "@/components/analytics/report-table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios · Gestão" };

export default async function ReportsPage(props: PageProps<"/manager/reports">) {
  const user = await requirePermissionPage("reports.view");
  const sp = await props.searchParams;
  const def = getReportDef(strParam(sp, "type")) ?? REPORTS[0];
  const reports = REPORTS.filter((r) => !r.hidden);
  const current = def.hidden ? REPORTS[0] : def;
  const period = parsePeriod(sp, { fallback: current.defaultPeriod, allowAll: true });
  const courseId = current.course ? strParam(sp, "course") : undefined;
  const status = current.statusOptions?.some((o) => o.value === strParam(sp, "status")) ? strParam(sp, "status") : undefined;
  const q = strParam(sp, "q");
  const page = pageParam(sp);

  const [result, courses] = await Promise.all([
    runReport(current, { period, courseId, status, q }, page),
    current.course ? courseOptions() : Promise.resolve([]),
  ]);

  const canExport = user.permissions.has("reports.export");
  const linkRows = user.permissions.has("students.view_all") || user.permissions.has("users.view");
  const exportQs = new URLSearchParams({ type: current.key, ...periodQuery(period), ...(courseId ? { course: courseId } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}) });

  const filters: ToolbarFilter[] = [];
  if (current.course) filters.push({ name: "course", label: "Todos os cursos", options: courses.map((c) => ({ value: c.id, label: c.title })) });
  if (current.statusOptions) filters.push({ name: "status", label: "Todas as situações", options: current.statusOptions });

  const periodText =
    period.key === "all" ? "Todo o período" : period.key === "custom" ? `${period.fromISO?.split("-").reverse().join("/")} a ${period.toISO.split("-").reverse().join("/")}` : `Últimos ${PERIOD_LABELS[period.key].toLowerCase()}`;

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow="Gestão"
        title="Relatórios"
        description="Escolha um relatório, ajuste os filtros e exporte. O CSV usa ponto e vírgula e acentuação UTF-8 — abre direto no Excel."
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton />
            {canExport && (
              <Button asChild>
                <a href={`/api/reports/export?${exportQs.toString()}`} download>
                  <Download /> Exportar CSV (Excel)
                </a>
              </Button>
            )}
          </div>
        }
      />

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Relatórios" className="mb-6 print:hidden lg:mb-0">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:sticky lg:top-20 lg:flex-col">
            {reports.map((r) => {
              const active = r.key === current.key;
              return (
                <li key={r.key} className="shrink-0">
                  <Link
                    href={`?type=${r.key}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
                      active ? "bg-surface-2 text-fg ring-1 ring-border lg:ring-0" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {r.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <div>
            <h2 className="text-h3">{current.label}</h2>
            <p className="mt-0.5 text-small text-muted">{current.description}</p>
            <p className="print-only mt-1 text-caption">
              Período: {periodText} · Gerado em {formatDateTime(new Date())} por {user.name}
            </p>
          </div>

          <div className="space-y-3 print:hidden">
            <PeriodFilter value={period.key} from={period.fromISO} to={period.toISO} allowAll comparison={current.dateLabel ? `Período pela ${current.dateLabel}` : null} />
            <TableToolbar placeholder={current.key === "certificates" ? "Buscar aluno ou código" : current.key === "courses" ? "Buscar curso" : "Buscar por nome ou e-mail"} filters={filters} />
          </div>

          {result.chart && result.total > 0 && <ReportChartView chart={result.chart} />}

          <div className="flex items-center justify-between gap-3">
            <p className="text-small text-muted">
              <span className="font-medium text-fg tabular-nums">{formatNumber(result.total)}</span> {result.total === 1 ? "registro" : "registros"} · {periodText}
            </p>
            {canExport && result.total > 0 && (
              <a href={`/api/reports/export?${exportQs.toString()}`} download className="inline-flex items-center gap-1.5 text-small font-medium text-primary hover:underline print:hidden">
                <FileSpreadsheet className="size-4" aria-hidden /> Baixar {formatNumber(result.total)} linhas
              </a>
            )}
          </div>

          {result.rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nada encontrado com esses filtros"
              description="Tente ampliar o período para “Todo o período” ou remover filtros de curso e situação."
              action={
                <Button variant="outline" asChild>
                  <Link href={`?type=${current.key}&period=all`}>Ver todo o período</Link>
                </Button>
              }
            />
          ) : (
            <>
              <ReportTable columns={current.columns} rows={result.rows} linkRows={linkRows} />
              <Pagination className="print:hidden" page={page} pageSize={REPORT_PAGE_SIZE} total={result.total} hrefFor={(p) => buildHref(sp, { page: p })} />
              {result.total > REPORT_PAGE_SIZE && (
                <p className="print-only text-caption">Impressão mostra a página atual ({formatNumber(result.rows.length)} de {formatNumber(result.total)}). Para a lista completa, exporte o CSV.</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
