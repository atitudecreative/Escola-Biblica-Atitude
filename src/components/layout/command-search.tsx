"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { ArrowRight, BookOpen, FileText, GraduationCap, MessagesSquare, PlayCircle, Presentation, Search } from "lucide-react";
import { quickSearchAction } from "@/app/(app)/shell-actions";
import type { SearchGroup } from "@/server/services/search";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const GROUP_ICON = { courses: BookOpen, lessons: PlayCircle, materials: FileText, teachers: Presentation, students: GraduationCap, discussions: MessagesSquare };

/** Busca global (⌘K / Ctrl+K). Resultados agrupados, navegação por teclado. */
export function CommandSearch({ variant = "bar" }: { variant?: "bar" | "icon" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const reqId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounce de 220ms; descarta respostas fora de ordem.
  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      start(async () => {
        const res = await quickSearchAction(q);
        if (id === reqId.current && res.ok) {
          setGroups(res.data);
          setActive(0);
        }
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const shown = q.trim().length < 2 ? [] : groups;
  const flat = shown.flatMap((g) => g.items);
  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < flat.length && flat[active]) go(flat[active].href);
      else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  let idx = -1;
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild>
        {variant === "bar" ? (
          <button className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface-2/70 px-3 text-sm text-subtle transition hover:border-border-strong hover:bg-surface-2">
            <Search className="size-4" />
            <span className="flex-1 text-left">Buscar cursos, aulas, pessoas…</span>
            <Kbd>⌘K</Kbd>
          </button>
        ) : (
          <button className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg" aria-label="Buscar">
            <Search className="size-4" />
          </button>
        )}
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in" />
        <D.Content className="fixed top-[8vh] left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg outline-none data-[state=open]:animate-scale-in">
          <D.Title className="sr-only">Busca global</D.Title>
          <D.Description className="sr-only">Digite para buscar cursos, aulas, materiais, professores e discussões</D.Description>
          <div className="flex items-center gap-3 border-b border-border px-4">
            {pending ? <Spinner className="text-subtle" /> : <Search className="size-4 text-subtle" />}
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="O que você procura?"
              className="h-13 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls="search-results"
              aria-label="Buscar"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 ? (
              <p className="px-3 py-8 text-center text-small text-subtle">Digite ao menos 2 caracteres.</p>
            ) : !pending && shown.length === 0 ? (
              <p className="px-3 py-8 text-center text-small text-muted">Nenhum resultado para “{q}”.</p>
            ) : (
              shown.map((g) => {
                const Icon = GROUP_ICON[g.key];
                return (
                  <div key={g.key} className="mb-1">
                    <p className="px-3 pt-2 pb-1 text-overline text-subtle">{g.label}</p>
                    {g.items.map((it) => {
                      idx++;
                      const my = idx;
                      return (
                        <button
                          key={it.id}
                          role="option"
                          aria-selected={active === my}
                          onMouseEnter={() => setActive(my)}
                          onClick={() => go(it.href)}
                          className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left", active === my && "bg-surface-2")}
                        >
                          <Icon className="size-4 shrink-0 text-subtle" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-fg">{it.title}</span>
                            {it.subtitle && <span className="block truncate text-caption text-subtle">{it.subtitle}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
            {q.trim().length >= 2 && (
              <button
                onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
                onMouseEnter={() => setActive(flat.length)}
                className={cn("mt-1 flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm text-primary", active === flat.length && "bg-surface-2")}
              >
                Ver todos os resultados para “{q.trim()}” <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
