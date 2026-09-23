"use client";
/**
 * Gráficos do produto (Recharts), seguindo as specs de dataviz:
 * linha 2px, área em ~10% de opacidade, barras <= 24px com topo arredondado,
 * grade em hairline recessiva, um único eixo Y, tooltip por padrão,
 * legenda para >= 2 séries e visão em tabela (alívio de contraste/acessibilidade).
 * Cores sempre por slot fixo (--series-N), nunca pela posição no ranking.
 */
import { useId, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps,
} from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Series = { key: string; label: string; slot?: 1 | 2 | 3 | 4 | 5 };
type Row = Record<string, string | number>;

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--chart-axis)", fontSize: 11 },
} as const;

function ChartTooltip({ active, payload, label, series, format }: Partial<TooltipContentProps<number, string>> & { series: Series[]; format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-lg border border-border bg-surface px-3 py-2 text-caption shadow-md">
      <p className="mb-1 font-medium text-fg">{label}</p>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full" style={{ background: `var(--series-${s?.slot ?? 1})` }} />
              {s?.label ?? p.name}
            </span>
            <span className="font-medium text-fg tabular-nums">{format(Number(p.value))}</span>
          </div>
        );
      })}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: `var(--series-${s.slot ?? i + 1})` }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function DataTable({ data, xKey, series, format }: { data: Row[]; xKey: string; series: Series[]; format: (n: number) => string }) {
  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-border">
      <table className="w-full text-caption">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted">Período</th>
            {series.map((s) => (
              <th key={s.key} className="px-3 py-2 text-right font-medium text-muted">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((r, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5">{r[xKey]}</td>
              {series.map((s) => (
                <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">{format(Number(r[s.key] ?? 0))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Moldura com título, legenda e alternância gráfico/tabela. */
export function ChartFrame({
  title,
  description,
  series,
  data,
  xKey,
  format = (n) => formatNumber(n),
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  series: Series[];
  data: Row[];
  xKey: string;
  format?: (n: number) => string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const [table, setTable] = useState(false);
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-h4">{title}</h3>
          {description && <p className="mt-0.5 text-small text-muted">{description}</p>}
        </div>
        <div className="flex items-center gap-1">
          {action}
          <button
            onClick={() => setTable((t) => !t)}
            className="rounded-md p-1.5 text-subtle transition hover:bg-surface-2 hover:text-fg"
            aria-label={table ? "Ver gráfico" : "Ver dados em tabela"}
            aria-pressed={table}
          >
            {table ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
          </button>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-small text-subtle">
          Sem dados para o período selecionado.
        </div>
      ) : table ? (
        <DataTable data={data} xKey={xKey} series={series} format={format} />
      ) : (
        <>
          {children}
          <div className="mt-3">
            <Legend series={series} />
          </div>
        </>
      )}
    </section>
  );
}

export function TrendChart({
  data,
  xKey,
  series,
  height = 240,
  format = (n: number) => formatNumber(n),
}: {
  data: Row[];
  xKey: string;
  series: Series[];
  height?: number;
  format?: (n: number) => string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div style={{ height }} role="img" aria-label={`Gráfico de linhas: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={`var(--series-${s.slot ?? i + 1})`} stopOpacity={0.12} />
                <stop offset="1" stopColor={`var(--series-${s.slot ?? i + 1})`} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} width={44} tickFormatter={(v) => formatNumber(Number(v))} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} series={series} format={format} />}
          />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={`var(--series-${s.slot ?? i + 1})`}
              strokeWidth={2}
              fill={`url(#${id}-${s.key})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ColumnChart({
  data,
  xKey,
  series,
  height = 240,
  stacked,
  format = (n: number) => formatNumber(n),
}: {
  data: Row[];
  xKey: string;
  series: Series[];
  height?: number;
  stacked?: boolean;
  format?: (n: number) => string;
}) {
  return (
    <div style={{ height }} role="img" aria-label={`Gráfico de colunas: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={8} />
          <YAxis {...axisProps} width={44} tickFormatter={(v) => formatNumber(Number(v))} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} series={series} format={format} />}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId={stacked ? "a" : undefined}
              fill={`var(--series-${s.slot ?? i + 1})`}
              maxBarSize={24}
              radius={stacked && i < series.length - 1 ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              stroke="var(--surface)"
              strokeWidth={stacked ? 2 : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranking horizontal em HTML (rótulos longos legíveis, acessível sem canvas). */
export function BarList({
  items,
  format = (n: number) => formatNumber(n),
  slot = 1,
  empty = "Sem dados",
}: {
  items: { id?: string; label: string; value: number; href?: string; hint?: string }[];
  format?: (n: number) => string;
  slot?: 1 | 2 | 3 | 4 | 5;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-8 text-center text-small text-subtle">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={it.id ?? `${i}-${it.label}`} title={`${it.label}: ${format(it.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-small">
            {it.href ? (
              <a href={it.href} className="truncate text-fg hover:text-primary">{it.label}</a>
            ) : (
              <span className="truncate text-fg">{it.label}</span>
            )}
            <span className="shrink-0 font-medium tabular-nums">{format(it.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: `var(--series-${slot})` }} />
          </div>
          {it.hint && <p className="mt-1 text-caption text-subtle">{it.hint}</p>}
        </li>
      ))}
    </ul>
  );
}
