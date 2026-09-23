"use client";
import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Textarea Markdown com abas Escrever/Visualizar (renderização segura). */
export function MarkdownEditor({
  value,
  onChange,
  rows = 10,
  placeholder,
  id,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const tabBtn = (t: "write" | "preview", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={cn("h-8 rounded-md px-3 text-small font-medium transition-colors", tab === t ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg")}
    >
      {label}
    </button>
  );
  return (
    <div className="overflow-hidden rounded-md border border-border-strong focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/40">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-1.5 py-1">
        <div role="tablist" className="flex gap-0.5">
          {tabBtn("write", "Escrever")}
          {tabBtn("preview", "Visualizar")}
        </div>
        <span className="hidden pr-2 text-caption text-subtle sm:inline">Markdown: **negrito**, _itálico_, # título, - lista, [link](https://…)</span>
      </div>
      {tab === "write" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="rounded-none border-0 font-mono text-[0.8125rem] shadow-none focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-40 bg-surface px-4 py-3" style={{ minHeight: `${rows * 1.5}rem` }}>
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-small text-subtle">Nada para visualizar ainda.</p>}
        </div>
      )}
    </div>
  );
}

/** Lista editável de frases (objetivos, requisitos, público-alvo). */
export function ListEditor({
  label,
  hint,
  items,
  onChange,
  placeholder,
  max = 20,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const id = useId();
  function add() {
    const v = draft.trim();
    if (!v || items.length >= max) return;
    onChange([...items, v]);
    setDraft("");
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium">{label}</label>
      {hint && <p className="-mt-1 text-caption text-subtle">{hint}</p>}
      {items.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-1 py-1 pr-1 pl-3">
              <Input
                value={it}
                onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
                aria-label={`${label} ${i + 1}`}
                className="h-8 border-0 px-0 shadow-none focus-visible:ring-0 sm:h-8"
                maxLength={240}
              />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para cima"><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Mover para baixo"><ArrowDown /></Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remover"><X /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          maxLength={240}
          disabled={items.length >= max}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim() || items.length >= max}>
          <Plus /> Adicionar
        </Button>
      </div>
    </div>
  );
}

/** Seleção/criação de tags com sugestões das existentes. */
export function TagInput({ value, onChange, suggestions, max = 12 }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[]; max?: number }) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const lower = value.map((v) => v.toLowerCase());
  const matches = draft.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(draft.trim().toLowerCase()) && !lower.includes(s.toLowerCase())).slice(0, 6)
    : [];
  function add(tag: string) {
    const t = tag.trim().slice(0, 40);
    if (!t || lower.includes(t.toLowerCase()) || value.length >= max) return;
    onChange([...value, t]);
    setDraft("");
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium">Tags</label>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/40">
        {value.map((t) => (
          <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-2.5 text-caption font-medium">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full p-0.5 text-subtle hover:bg-surface-3 hover:text-fg" aria-label={`Remover tag ${t}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          placeholder={value.length ? "" : "Digite e pressione Enter"}
          className="h-7 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
          disabled={value.length >= max}
        />
      </div>
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Sugestões">
          {matches.map((m) => (
            <button key={m} type="button" onClick={() => add(m)} className="inline-flex h-7 items-center gap-1 rounded-full border border-border px-2.5 text-caption text-muted hover:border-primary hover:text-primary">
              <Plus className="size-3" /> {m}
            </button>
          ))}
        </div>
      )}
      <p className="text-caption text-subtle">Ajudam na busca do catálogo. Até {max} tags.</p>
    </div>
  );
}

/** Barra de salvar fixa no rodapé do formulário (aparece quando há alterações). */
export function SaveBar({ dirty, pending, onReset, label = "Salvar alterações", floating = true }: { dirty: boolean; pending: boolean; onReset: () => void; label?: string; floating?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        floating
          ? "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:shadow-md md:bottom-0"
          : "border-t border-border pt-4",
        floating && !dirty && "sm:shadow-none",
      )}
    >
      <p className="text-small text-muted" aria-live="polite">{dirty ? "Você tem alterações não salvas." : "Tudo salvo."}</p>
      <div className="flex gap-2">
        {dirty && (
          <Button type="button" variant="ghost" onClick={onReset} disabled={pending}>
            Descartar
          </Button>
        )}
        <Button type="submit" loading={pending} disabled={!dirty}>
          {label}
        </Button>
      </div>
    </div>
  );
}
