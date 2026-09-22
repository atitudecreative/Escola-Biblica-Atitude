import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicador (KPI). Pensado para aparecer em grupos compactos — não use como
 * decoração: cada número precisa responder a uma pergunta do usuário.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  delta?: number | null;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-medium text-muted">{label}</p>
        {Icon && <Icon className="size-4 text-subtle" aria-hidden />}
      </div>
      <p className="mt-2 text-[1.625rem] leading-8 font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      {(hint || delta != null) && (
        <div className="mt-1 flex items-center gap-1.5 text-caption text-subtle">
          {delta != null && (
            <span className={cn("inline-flex items-center font-medium", delta >= 0 ? "text-success" : "text-danger")}>
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
          {hint}
        </div>
      )}
    </div>
  );
}

/** Faixa de KPIs em uma única superfície com divisórias — menos "cards", mais leitura. */
export function StatStrip({ items, className }: { items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface shadow-xs lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none", className)}>
      {items.map((it, i) => (
        <div key={i} className="border-border p-4 sm:p-5 [&:not(:last-child)]:border-b odd:border-r lg:border-b-0 lg:[&:not(:last-child)]:border-r lg:odd:border-r-0 lg:[&:not(:last-child)]:!border-r">
          <p className="text-small text-muted">{it.label}</p>
          <p className="mt-1.5 text-[1.5rem] leading-8 font-semibold tracking-tight tabular-nums">{it.value}</p>
          {it.hint && <p className="mt-0.5 text-caption text-subtle">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}
