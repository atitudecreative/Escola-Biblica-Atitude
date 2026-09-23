"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, Star } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string; count?: number };
export type FacetData = { categories: Opt[]; levels: Opt[]; durations: Opt[]; teachers: Opt[] };

function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  };
  return { params, set, pending };
}

export function CatalogSearch() {
  const { params, set, pending } = useFilters();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        set({ q: q.trim() || null });
      }}
      className="relative flex-1"
    >
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => q.trim() !== (params.get("q") ?? "") && set({ q: q.trim() || null })}
        placeholder="Pesquisar cursos, temas ou professores…"
        className="h-11 pl-10 text-[0.9375rem] sm:h-11"
        aria-label="Pesquisar cursos"
      />
      {pending && <Spinner className="absolute top-1/2 right-3.5 -translate-y-1/2 text-subtle" />}
    </form>
  );
}

export function CatalogSort() {
  const { params, set } = useFilters();
  return (
    <NativeSelect aria-label="Ordenar por" value={params.get("sort") ?? "popular"} onChange={(e) => set({ sort: e.target.value === "popular" ? null : e.target.value })} className="sm:w-48" selectClassName="h-11 sm:h-11">
      <option value="popular">Mais populares</option>
      <option value="rating">Mais bem avaliados</option>
      <option value="newest">Mais recentes</option>
      <option value="title">Ordem alfabética</option>
    </NativeSelect>
  );
}

function FacetGroup({ title, name, options, single = true }: { title: string; name: string; options: Opt[]; single?: boolean }) {
  const { params, set } = useFilters();
  const current = params.get(name);
  return (
    <fieldset>
      <legend className="mb-2 text-overline text-subtle">{title}</legend>
      <ul className="space-y-0.5">
        {options.map((o) => {
          const active = current === o.value;
          return (
            <li key={o.value}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => set({ [name]: active && single ? null : o.value })}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                  active ? "bg-primary-soft font-medium text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.count != null && <span className="text-caption tabular-nums text-subtle">{o.count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function FiltersPanel({ facets }: { facets: FacetData }) {
  const { params, set } = useFilters();
  const rating = params.get("rating");
  return (
    <div className="space-y-7">
      <FacetGroup title="Categoria" name="category" options={facets.categories} />
      <FacetGroup title="Nível" name="level" options={facets.levels} />
      <FacetGroup title="Duração" name="duration" options={facets.durations} />
      <fieldset>
        <legend className="mb-2 text-overline text-subtle">Avaliação</legend>
        <div className="flex gap-1.5">
          {["4.5", "4", "3"].map((r) => (
            <button
              key={r}
              aria-pressed={rating === r}
              onClick={() => set({ rating: rating === r ? null : r })}
              className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-small", rating === r ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border text-muted hover:border-border-strong")}
            >
              <Star className="size-3.5 fill-accent text-accent" /> {r.replace(".", ",")}+
            </button>
          ))}
        </div>
      </fieldset>
      {facets.teachers.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-overline text-subtle">Professor</legend>
          <NativeSelect aria-label="Professor" value={params.get("teacher") ?? ""} onChange={(e) => set({ teacher: e.target.value || null })}>
            <option value="">Todos</option>
            {facets.teachers.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </NativeSelect>
        </fieldset>
      )}
    </div>
  );
}

export function CatalogSidebar({ facets }: { facets: FacetData }) {
  return (
    <aside aria-label="Filtros" className="hidden lg:block">
      <div className="sticky top-24">
        <FiltersPanel facets={facets} />
      </div>
    </aside>
  );
}

export function MobileFilters({ facets, activeCount }: { facets: FacetData; activeCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="lg" className="h-11 lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> Filtros {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[0.6875rem] text-primary-fg">{activeCount}</span>}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" title="Filtros">
          <div className="p-5">
            <FiltersPanel facets={facets} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
