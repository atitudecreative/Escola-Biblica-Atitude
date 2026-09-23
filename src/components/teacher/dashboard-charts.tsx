"use client";
import { BarList, ChartFrame, ColumnChart, TrendChart } from "@/components/charts/charts";
import { formatNumber, formatPercent } from "@/lib/format";

/** Gráficos do painel do professor (wrappers client para poder formatar valores). */

const pct = (n: number) => formatPercent(n);

function short(title: string, max = 16) {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;
}

export function ActivityChart({ data }: { data: { dia: string; ativos: number; aulas: number }[] }) {
  const empty = data.every((d) => d.ativos === 0 && d.aulas === 0);
  const series = [
    { key: "ativos", label: "Alunos ativos", slot: 1 as const },
    { key: "aulas", label: "Aulas concluídas", slot: 3 as const },
  ];
  return (
    <ChartFrame
      title="Atividade dos alunos"
      description="Últimos 30 dias, considerando apenas alunos dos seus cursos"
      series={series}
      data={empty ? [] : data}
      xKey="dia"
    >
      <TrendChart data={data} xKey="dia" series={series} height={240} />
    </ChartFrame>
  );
}

export function CourseProgressChart({ data }: { data: { title: string; avgProgress: number; completion: number }[] }) {
  const rows = data.slice(0, 8).map((d) => ({ curso: short(d.title), progresso: d.avgProgress, conclusao: d.completion }));
  const series = [
    { key: "progresso", label: "Progresso médio", slot: 1 as const },
    { key: "conclusao", label: "Concluíram o curso", slot: 2 as const },
  ];
  return (
    <ChartFrame title="Progresso por curso" description="Média de progresso e taxa de conclusão das turmas" series={series} data={rows} xKey="curso" format={pct}>
      <ColumnChart data={rows} xKey="curso" series={series} height={240} format={pct} />
    </ChartFrame>
  );
}

export function StudentsPerCourse({ data }: { data: { id: string; title: string; students: number }[] }) {
  const items = data.slice(0, 8).map((d) => ({ id: d.id, label: d.title, value: d.students, href: `/teacher/courses/${d.id}?tab=students` }));
  return (
    <ChartFrame title="Alunos por curso" description="Matrículas ativas e concluídas" series={[{ key: "value", label: "Alunos" }]} data={items} xKey="label">
      <BarList items={items} format={(n) => formatNumber(n)} empty="Nenhum aluno matriculado ainda." />
    </ChartFrame>
  );
}

export function QuizPerformance({ data }: { data: { id: string; label: string; course: string; avg: number; passRate: number; attempts: number }[] }) {
  const items = data.map((d) => ({
    id: d.id,
    label: d.label,
    value: d.avg,
    hint: `${d.course} · ${formatNumber(d.attempts)} tentativa(s) · ${formatPercent(d.passRate)} de aprovação`,
  }));
  return (
    <ChartFrame
      title="Desempenho em avaliações"
      description="Nota média dos questionários corrigidos"
      series={[{ key: "value", label: "Nota média" }]}
      data={items}
      xKey="label"
      format={pct}
    >
      <BarList items={items} format={pct} slot={3} empty="Nenhuma tentativa corrigida ainda." />
    </ChartFrame>
  );
}
