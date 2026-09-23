"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PERIOD_LABELS, type PeriodKey } from "@/lib/analytics-period";
import { cn } from "@/lib/utils";

/**
 * Filtro de período sincronizado com a URL (?period=&from=&to=).
 * Presets em controle segmentado + intervalo personalizado com datas.
 */
export function PeriodFilter({
  value,
  from,
  to,
  allowAll,
  comparison,
  className,
}: {
  value: PeriodKey;
  from: string | null;
  to: string;
  allowAll?: boolean;
  /** texto "comparado a …" exibido à direita */
  comparison?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState(value === "custom");
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to);

  function go(patch: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  const keys: PeriodKey[] = ["today", "7d", "30d", "90d", ...(allowAll ? (["all"] as PeriodKey[]) : [])];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={cn("flex flex-col gap-2 print:hidden lg:flex-row lg:items-center", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Período" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-surface-2 p-0.5 [scrollbar-width:none]">
          {keys.map((k) => {
            const active = !custom && value === k;
            return (
              <button
                key={k}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setCustom(false);
                  go({ period: k, from: null, to: null });
                }}
                className={cn(
                  "h-8 shrink-0 rounded-md px-3 text-small font-medium whitespace-nowrap text-muted transition-all hover:text-fg",
                  active && "bg-surface text-fg shadow-xs",
                )}
              >
                {PERIOD_LABELS[k]}
              </button>
            );
          })}
          <button
            role="radio"
            aria-checked={custom}
            onClick={() => setCustom(true)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-small font-medium whitespace-nowrap text-muted transition-all hover:text-fg",
              custom && "bg-surface text-fg shadow-xs",
            )}
          >
            <CalendarRange className="size-3.5" aria-hidden />
            Personalizado
          </button>
        </div>
        {pending && <Spinner className="text-subtle" />}
      </div>

      {custom && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (f && t) go({ period: "custom", from: f, to: t });
          }}
        >
          <label className="sr-only" htmlFor="period-from">Data inicial</label>
          <Input id="period-from" type="date" value={f} max={t || today} onChange={(e) => setF(e.target.value)} className="h-9 w-[9.5rem]" required />
          <span className="text-small text-subtle">até</span>
          <label className="sr-only" htmlFor="period-to">Data final</label>
          <Input id="period-to" type="date" value={t} min={f || undefined} max={today} onChange={(e) => setT(e.target.value)} className="h-9 w-[9.5rem]" required />
          <Button type="submit" size="sm" variant="outline" disabled={!f || !t}>
            Aplicar
          </Button>
        </form>
      )}

      {comparison && <p className="text-caption text-subtle lg:ml-auto">{comparison}</p>}
    </div>
  );
}
