"use client";
import * as React from "react";
import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Seleção de linhas para ações em massa em tabelas renderizadas no servidor.
 * <BulkSelectProvider ids={[...]}> envolve a tabela; use <BulkHeaderCheckbox/>,
 * <RowCheckbox id/> e <BulkBar>{(ids, clear) => ações}</BulkBar>.
 */
type Ctx = { ids: string[]; selected: Set<string>; toggle: (id: string) => void; setAll: (on: boolean) => void; clear: () => void };
const C = React.createContext<Ctx | null>(null);

export function BulkSelectProvider({ ids, children }: { ids: string[]; children: React.ReactNode }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const key = ids.join(",");
  // Mantém apenas IDs presentes na página atual (após filtrar/paginar).
  React.useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => ids.includes(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const value: Ctx = {
    ids,
    selected,
    toggle: (id) =>
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    setAll: (on) => setSelected(on ? new Set(ids) : new Set()),
    clear: () => setSelected(new Set()),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

function useBulk() {
  const c = React.useContext(C);
  if (!c) throw new Error("BulkSelectProvider ausente");
  return c;
}

export function BulkHeaderCheckbox() {
  const { ids, selected, setAll } = useBulk();
  const all = ids.length > 0 && selected.size === ids.length;
  return (
    <Checkbox
      aria-label="Selecionar todos"
      checked={all ? true : selected.size ? "indeterminate" : false}
      onCheckedChange={(v) => setAll(v === true)}
    />
  );
}

export function RowCheckbox({ id, label }: { id: string; label?: string }) {
  const { selected, toggle } = useBulk();
  return <Checkbox aria-label={label ?? "Selecionar linha"} checked={selected.has(id)} onCheckedChange={() => toggle(id)} />;
}

export function BulkBar({ children }: { children: (ids: string[], clear: () => void) => React.ReactNode }) {
  const { selected, clear } = useBulk();
  if (!selected.size) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-lg animate-slide-up md:bottom-6">
      <button onClick={clear} className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Limpar seleção">
        <X className="size-4" />
      </button>
      <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">{children([...selected], clear)}</div>
    </div>
  );
}
