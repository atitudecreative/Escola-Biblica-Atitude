import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Award, BookOpenCheck, ClipboardCheck, GraduationCap, Minus, UserPlus } from "lucide-react";
import { StatStrip } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartCard, EngagementChart, RankingCard } from "@/components/analytics/chart-cards";
import { formatDateTime, formatDuration, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { isoDay, type Period } from "@/lib/analytics-period";
import type { ActivityItem, Kpi, getKpis, getSeries, topCourses, topTeachers } from "@/server/services/analytics";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Kpis = Awaited<ReturnType<typeof getKpis>>;
type SeriesData = Awaited<ReturnType<typeof getSeries>>;

const fmtDay = (d: Date) => isoDay(d).split("-").reverse().slice(0, 2).join("/");

export function comparisonLabel(p: Period) {
  if (!p.prevFrom || !p.prevTo) return null;
  const last = new Date(p.prevTo.getTime() - 86_400_000);
  return p.days === 1 ? `Comparado a ${fmtDay(p.prevFrom)}` : `Comparado a ${fmtDay(p.prevFrom)} – ${fmtDay(last)}`;
}

/** Variação vs. período anterior. Sem base de comparação, diz isso em vez de inventar um número. */
export function Delta({ kpi, className }: { kpi: Kpi; className?: string }) {
  if (kpi.previous == null) return <span className={cn("text-subtle", className)}>sem comparação</span>;
  if (kpi.delta == null) return <span className={cn("text-subtle", className)}>antes: 0</span>;
  const d = Math.round(kpi.delta);
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn("inline-flex items-center font-medium tabular-nums", d > 0 ? "text-success" : d < 0 ? "text-danger" : "text-muted")}>
        <Icon className="size-3.5" aria-hidden />
        {d > 0 ? "+" : ""}
        {d}%
      </span>
      <span className="text-subtle">vs. anterior</span>
    </span>
  );
}

function hours(n: number) {
  return n >= 100 ? formatNumber(n) : formatNumber(n, 1);
}

/** Linha secundária de números de base (menor que a faixa principal). */
function BaseMetrics({ items }: { items: { label: string; value: React.ReactNode; hint?: string; href?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface-2/40 px-4 py-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="truncate text-caption text-muted">{it.label}</dt>
          <dd className="mt-0.5 flex items-baseline gap-1.5">
            {it.href ? (
              <Link href={it.href} className="text-h4 font-semibold tabular-nums hover:text-primary">{it.value}</Link>
            ) : (
              <span className="text-h4 font-semibold tabular-nums">{it.value}</span>
            )}
            {it.hint && <span className="truncate text-caption text-subtle">{it.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const ACTIVITY: Record<ActivityItem["kind"], { label: string; tone: Tone; Icon: typeof UserPlus }> = {
  signup: { label: "Cadastro", tone: "neutral", Icon: UserPlus },
  enrollment: { label: "Matrícula", tone: "info", Icon: GraduationCap },
  completion: { label: "Conclusão", tone: "success", Icon: BookOpenCheck },
  certificate: { label: "Certificado", tone: "accent", Icon: Award },
  submission: { label: "Entrega", tone: "warning", Icon: ClipboardCheck },
};

export function RecentActivity({ items, studentHref = true }: { items: ActivityItem[]; studentHref?: boolean }) {
  if (!items.length) return <EmptyState compact icon={GraduationCap} title="Nenhuma atividade ainda" description="Matrículas, entregas e conclusões aparecem aqui assim que acontecerem." />;
  const who = (it: ActivityItem) =>
    studentHref ? (
      <Link href={`/admin/students/${it.user.id}`} className="font-medium text-fg hover:underline">{it.user.name}</Link>
    ) : (
      <span className="font-medium text-fg">{it.user.name}</span>
    );
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h3 className="text-h4">Atividade recente</h3>
        <span className="text-caption text-subtle">Últimos eventos da plataforma</span>
      </div>
      <div className="hidden md:block">
        <Table>
          <THead>
            <tr>
              <TH>Evento</TH>
              <TH>Pessoa</TH>
              <TH>Referente a</TH>
              <TH className="text-right">Quando</TH>
            </tr>
          </THead>
          <TBody>
            {items.map((it) => {
              const a = ACTIVITY[it.kind];
              return (
                <TR key={it.id}>
                  <TD className="h-12">
                    <Badge tone={a.tone}>
                      <a.Icon aria-hidden />
                      {a.label}
                    </Badge>
                  </TD>
                  <TD className="h-12">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={it.user.name} src={it.user.avatarUrl} size="xs" />
                      {who(it)}
                    </div>
                  </TD>
                  <TD className="h-12 max-w-[22rem] truncate text-muted">{it.subject}</TD>
                  <TD className="h-12 text-right text-small whitespace-nowrap text-muted" title={formatDateTime(it.at)}>{timeAgo(it.at)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {items.map((it) => {
          const a = ACTIVITY[it.kind];
          return (
            <li key={it.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar name={it.user.name} src={it.user.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-small">{who(it)}</p>
                <p className="truncate text-caption text-muted">{a.label} · {it.subject}</p>
              </div>
              <span className="shrink-0 text-caption text-subtle">{timeAgo(it.at)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AnalyticsDashboard({
  kpis,
  series,
  courses,
  teachers,
  activity,
  canOpenPeople = true,
}: {
  kpis: Kpis;
  series: SeriesData;
  courses: Awaited<ReturnType<typeof topCourses>>;
  teachers: Awaited<ReturnType<typeof topTeachers>>;
  activity: ActivityItem[];
  canOpenPeople?: boolean;
}) {
  const ctx = series.expanded ? "Últimos 14 dias, para dar contexto ao dia de hoje" : series.bucket === "day" ? "Por dia" : series.bucket === "week" ? "Por semana" : "Por mês";
  return (
    <div className="space-y-6">
      <StatStrip
        items={[
          { label: "Alunos ativos", value: formatNumber(kpis.activeStudents.value), hint: <Delta kpi={kpis.activeStudents} /> },
          { label: "Horas estudadas", value: `${hours(kpis.hours.value)} h`, hint: <Delta kpi={kpis.hours} /> },
          { label: "Matrículas", value: formatNumber(kpis.enrollments.value), hint: <Delta kpi={kpis.enrollments} /> },
          { label: "Conclusões", value: formatNumber(kpis.completions.value), hint: <Delta kpi={kpis.completions} /> },
          { label: "Certificados emitidos", value: formatNumber(kpis.certificates.value), hint: <Delta kpi={kpis.certificates} /> },
        ]}
      />

      <BaseMetrics
        items={[
          { label: "Total de alunos", value: formatNumber(kpis.totalStudents), hint: kpis.newStudents.value ? `+${formatNumber(kpis.newStudents.value)} no período` : undefined, href: canOpenPeople ? "/admin/students" : undefined },
          { label: "Professores", value: formatNumber(kpis.teachers), href: canOpenPeople ? "/admin/teachers" : undefined },
          { label: "Gestores", value: formatNumber(kpis.managers) },
          { label: "Cursos", value: formatNumber(kpis.courses), hint: `${formatNumber(kpis.publishedCourses)} publicados` },
          { label: "Aulas publicadas", value: formatNumber(kpis.lessons) },
          { label: "Taxa de conclusão", value: formatPercent(kpis.completionRate), hint: "das matrículas" },
        ]}
      />

      <EngagementChart
        data={series.engagement}
        description={`${ctx} · média de ${formatDuration(kpis.hoursPerActive * 3600)} por aluno ativo no período`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard kind="column" title="Matrículas" description={ctx} data={series.enrollments} series={[{ key: "enrollments", label: "Matrículas", slot: 1 }]} />
        <ChartCard kind="column" title="Conclusões" description={ctx} data={series.completions} series={[{ key: "completions", label: "Conclusões", slot: 2 }]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard kind="trend" title="Crescimento de alunos" description="Total acumulado de alunos cadastrados" data={series.growth} series={[{ key: "total", label: "Alunos", slot: 3 }]} />
        <ChartCard
          kind="column"
          title="Acessos"
          description="Dias de estudo registrados (um aluno em um dia = 1 acesso)"
          data={series.access}
          series={[{ key: "sessions", label: "Acessos", slot: 5 }]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankingCard
          title="Cursos mais acessados"
          description="Alunos distintos que estudaram no período"
          items={courses.map((c) => ({ label: c.title, value: c.students, hint: `${formatDuration(c.seconds)} assistidos · ${formatNumber(c.lessonsCompleted)} aulas concluídas` }))}
          empty="Nenhum acesso a cursos no período."
        />
        <RankingCard
          title="Professores mais ativos"
          description="Correções, aulas criadas, comunicados e respostas no período"
          slot={2}
          items={teachers.map((t) => ({
            label: t.name,
            value: t.score,
            href: canOpenPeople ? `/admin/teachers/${t.id}` : undefined,
            hint: [`${t.gradings} correções`, `${t.lessons} aulas`, `${t.announcements} comunicados`, `${t.replies} respostas`].join(" · "),
          }))}
          empty="Nenhuma atividade docente no período."
        />
      </div>

      <RecentActivity items={activity} studentHref={canOpenPeople} />
    </div>
  );
}
