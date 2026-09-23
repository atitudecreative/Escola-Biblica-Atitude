import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ClipboardList, FileBarChart, Layers, MailWarning, Settings, ShieldBan, Users } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { adminAlerts, getKpis, getSeries, recentActivity, topCourses, topTeachers } from "@/server/services/analytics";
import { parsePeriod } from "@/lib/analytics-period";
import { formatNumber, pluralize, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/analytics/period-filter";
import { AnalyticsDashboard, comparisonLabel } from "@/components/analytics/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visão geral · Administração" };

type AlertItem = { key: string; tone: "warning" | "danger" | "info"; icon: typeof Layers; title: string; description: string; href: string; cta: string };

export default async function AdminOverviewPage(props: PageProps<"/admin">) {
  const user = await requirePermissionPage("users.manage", "settings.manage");
  const period = parsePeriod(await props.searchParams);
  const [alerts, kpis, series, courses, teachers, activity] = await Promise.all([
    adminAlerts(),
    getKpis(period),
    getSeries(period),
    topCourses(period),
    topTeachers(period),
    recentActivity(10),
  ]);

  const items: AlertItem[] = [];
  if (alerts.reviewCount)
    items.push({
      key: "review",
      tone: "warning",
      icon: Layers,
      title: `${pluralize(alerts.reviewCount, "curso aguardando", "cursos aguardando")} revisão`,
      description: alerts.review.map((c) => `${c.title} (${c.instructor.name})`).join(" · "),
      href: "/admin/courses?status=REVIEW",
      cta: "Revisar",
    });
  if (alerts.pendingSubmissions)
    items.push({
      key: "subs",
      tone: "info",
      icon: ClipboardList,
      title: `${pluralize(alerts.pendingSubmissions, "entrega pendente", "entregas pendentes")} de correção`,
      description: alerts.oldestPendingAt ? `A mais antiga foi enviada ${timeAgo(alerts.oldestPendingAt)}.` : "Aguardando os professores.",
      href: "/manager/reports?type=submissions&period=all&status=SUBMITTED",
      cta: "Ver entregas",
    });
  if (alerts.failedEmails)
    items.push({
      key: "email",
      tone: "danger",
      icon: MailWarning,
      title: `${pluralize(alerts.failedEmails, "e-mail falhou", "e-mails falharam")} nos últimos 7 dias`,
      description: "Verifique a configuração do provedor de e-mail e reenvie se necessário.",
      href: "/admin/logs?tab=emails",
      cta: "Abrir logs",
    });
  if (alerts.blocked)
    items.push({
      key: "blocked",
      tone: "info",
      icon: ShieldBan,
      title: `${pluralize(alerts.blocked, "conta bloqueada", "contas bloqueadas")}`,
      description: "Contas bloqueadas não conseguem entrar na plataforma.",
      href: "/admin/users?status=BLOCKED",
      cta: "Ver contas",
    });

  const shortcuts = [
    { href: "/admin/users", label: "Usuários", hint: `${formatNumber(alerts.totalUsers)} contas`, icon: Users, show: user.permissions.has("users.manage") },
    { href: "/admin/courses?status=REVIEW", label: "Cursos em revisão", hint: alerts.reviewCount ? `${alerts.reviewCount} na fila` : "Fila vazia", icon: Layers, show: true },
    { href: "/manager/reports", label: "Relatórios", hint: "CSV e impressão", icon: FileBarChart, show: user.permissions.has("reports.view") },
    { href: "/admin/settings", label: "Configurações", hint: "Plataforma e e-mail", icon: Settings, show: user.permissions.has("settings.manage") },
  ].filter((s) => s.show);

  const toneBar = { warning: "bg-warning", danger: "bg-danger", info: "bg-info" };
  const toneIcon = { warning: "text-warning", danger: "text-danger", info: "text-info" };

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Visão geral"
        description="O que precisa da sua atenção hoje e como a Escola está evoluindo."
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="alerts-title" className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <h2 id="alerts-title" className="text-h4">Precisa de atenção</h2>
            {items.length > 0 && <span className="text-caption text-subtle">{pluralize(items.length, "item", "itens")}</span>}
          </div>
          {items.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-6 sm:px-5">
              <CheckCircle2 className="size-5 text-success" aria-hidden />
              <p className="text-sm text-muted">Tudo em dia: nenhuma revisão, correção ou falha de e-mail pendente.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((a) => (
                <li key={a.key} className="relative flex items-start gap-3 px-4 py-3.5 sm:items-center sm:px-5">
                  <span aria-hidden className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", toneBar[a.tone])} />
                  <a.icon className={cn("mt-0.5 size-4 shrink-0 sm:mt-0", toneIcon[a.tone])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{a.title}</p>
                    <p className="truncate text-caption text-muted">{a.description}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="shrink-0">
                    <Link href={a.href}>
                      {a.cta} <ArrowRight />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <nav aria-label="Atalhos" className="rounded-xl border border-border bg-surface p-2 shadow-xs">
          <p className="px-3 pt-2 pb-1 text-overline text-subtle">Atalhos</p>
          <ul>
            {shortcuts.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-2">
                  <s.icon className="size-4 text-subtle group-hover:text-fg" aria-hidden />
                  <span className="text-sm font-medium text-fg">{s.label}</span>
                  <span className="ml-auto text-caption text-subtle">{s.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-h3">Indicadores</h2>
      </div>
      <PeriodFilter className="mb-6" value={period.key} from={period.fromISO} to={period.toISO} comparison={comparisonLabel(period)} />
      <AnalyticsDashboard kpis={kpis} series={series} courses={courses} teachers={teachers} activity={activity} />
    </>
  );
}
