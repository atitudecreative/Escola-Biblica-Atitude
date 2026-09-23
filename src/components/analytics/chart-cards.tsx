"use client";
/**
 * Wrappers client dos gráficos compartilhados (components/charts/charts.tsx).
 * Server Components não podem passar funções de formatação para o client,
 * então os formatos são escolhidos por chave.
 */
import { useState } from "react";
import { BarList, ChartFrame, ColumnChart, TrendChart, type Series } from "@/components/charts/charts";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FormatKey = "number" | "hours" | "percent";
type Row = Record<string, string | number>;

export const formatters: Record<FormatKey, (n: number) => string> = {
  number: (n) => formatNumber(n),
  hours: (n) => `${formatNumber(n, 1)} h`,
  percent: (n) => `${formatNumber(n)}%`,
};

export function ChartCard({
  kind,
  title,
  description,
  data,
  series,
  xKey = "label",
  format = "number",
  height = 220,
  className,
}: {
  kind: "trend" | "column";
  title: string;
  description?: string;
  data: Row[];
  series: Series[];
  xKey?: string;
  format?: FormatKey;
  height?: number;
  className?: string;
}) {
  const fmt = formatters[format];
  const empty = data.every((r) => series.every((s) => !Number(r[s.key])));
  return (
    <ChartFrame title={title} description={description} series={series} data={empty ? [] : data} xKey={xKey} format={fmt} className={className}>
      {kind === "trend" ? (
        <TrendChart data={data} xKey={xKey} series={series} height={height} format={fmt} />
      ) : (
        <ColumnChart data={data} xKey={xKey} series={series} height={height} format={fmt} />
      )}
    </ChartFrame>
  );
}

/** Gráfico principal: uma métrica por vez (sem eixo duplo), escolhida no seletor. */
export function EngagementChart({ data, description }: { data: Row[]; description?: string }) {
  const metrics = [
    { key: "hours", short: "Horas", label: "Horas estudadas", format: "hours" as const, slot: 1 as const },
    { key: "active", short: "Alunos", label: "Alunos ativos", format: "number" as const, slot: 3 as const },
    { key: "lessons", short: "Aulas", label: "Aulas concluídas", format: "number" as const, slot: 2 as const },
  ];
  const [metric, setMetric] = useState(metrics[0]);
  const series: Series[] = [{ key: metric.key, label: metric.label, slot: metric.slot }];
  const empty = data.every((r) => !Number(r.hours) && !Number(r.active));
  return (
    <ChartFrame
      title="Engajamento"
      description={description}
      series={series}
      data={empty ? [] : data}
      xKey="label"
      format={formatters[metric.format]}
      action={
        <div role="radiogroup" aria-label="Métrica" className="mr-1 hidden rounded-lg bg-surface-2 p-0.5 sm:inline-flex">
          {metrics.map((m) => (
            <button
              key={m.key}
              role="radio"
              aria-checked={metric.key === m.key}
              onClick={() => setMetric(m)}
              className={cn(
                "h-7 rounded-md px-2.5 text-caption font-medium text-muted transition-all hover:text-fg",
                metric.key === m.key && "bg-surface text-fg shadow-xs",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex gap-1 sm:hidden" role="radiogroup" aria-label="Métrica">
        {metrics.map((m) => (
          <button
            key={m.key}
            role="radio"
            aria-checked={metric.key === m.key}
            onClick={() => setMetric(m)}
            className={cn(
              "h-8 flex-1 rounded-md px-2 text-caption font-medium text-muted ring-1 ring-border",
              metric.key === m.key && "bg-surface-2 text-fg ring-border-strong",
            )}
          >
            {m.short}
          </button>
        ))}
      </div>
      <TrendChart data={data} xKey="label" series={series} height={280} format={formatters[metric.format]} />
    </ChartFrame>
  );
}

export function RankingCard({
  title,
  description,
  items,
  format = "number",
  slot = 1,
  empty,
  footer,
  className,
}: {
  title: string;
  description?: string;
  items: { label: string; value: number; href?: string; hint?: string }[];
  format?: FormatKey;
  slot?: 1 | 2 | 3 | 4 | 5;
  empty?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5", className)}>
      <div className="mb-4">
        <h3 className="text-h4">{title}</h3>
        {description && <p className="mt-0.5 text-small text-muted">{description}</p>}
      </div>
      <BarList items={items} format={formatters[format]} slot={slot} empty={empty} />
      {footer && <div className="mt-4 border-t border-border pt-3">{footer}</div>}
    </section>
  );
}
