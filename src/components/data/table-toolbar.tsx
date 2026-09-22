"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ToolbarFilter = { name: string; label: string; options: { value: string; label: string }[] };

/**
 * Barra de busca + filtros sincronizada com a URL (?q=&status=...).
 * A página (Server Component) lê os searchParams e consulta o banco —
 * filtros, ordenação e paginação ficam compartilháveis por link.
 */
export function TableToolbar({
  placeholder = "Buscar…",
  filters = [],
  children,
  className,
}: {
  placeholder?: string;
  filters?: ToolbarFilter[];
  children?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  function push(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = filters.some((f) => params.get(f.name)) || !!params.get("q");

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <div className="relative sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
        {pending && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle" />}
      </div>
      {filters.map((f) => (
        <NativeSelect
          key={f.name}
          aria-label={f.label}
          value={params.get(f.name) ?? ""}
          onChange={(e) => push({ [f.name]: e.target.value || null })}
          className="sm:w-auto sm:min-w-40"
        >
          <option value="">{f.label}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      ))}
      {active && (
        <button
          onClick={() => {
            setQ("");
            const reset: Record<string, null> = { q: null };
            for (const f of filters) reset[f.name] = null;
            push(reset);
          }}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-small font-medium text-muted hover:text-fg"
        >
          <X className="size-3.5" /> Limpar filtros
        </button>
      )}
      {children && <div className="flex items-center gap-2 sm:ml-auto">{children}</div>}
    </div>
  );
}
