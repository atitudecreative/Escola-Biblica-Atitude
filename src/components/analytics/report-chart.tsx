"use client";
import { ChartCard, RankingCard } from "@/components/analytics/chart-cards";
import type { ReportChart } from "@/server/services/reports";

export function ReportChartView({ chart }: { chart: ReportChart }) {
  if (chart.kind === "bars") {
    return <RankingCard title={chart.title} description={chart.description} items={chart.items} format={chart.format} empty="Sem dados para os filtros escolhidos." />;
  }
  return <ChartCard kind={chart.kind} title={chart.title} description={chart.description} data={chart.data} series={chart.series} xKey={chart.xKey} format={chart.format} height={200} />;
}
