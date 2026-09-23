"use client";
import { useId, useState } from "react";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

/**
 * Campo de texto com abas Escrever / Visualizar. A prévia usa o mesmo
 * <Markdown> seguro da exibição final (HTML bruto é ignorado).
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 8,
  maxLength,
  invalid,
  id,
  "aria-describedby": describedBy,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border-strong bg-surface shadow-xs focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/40",
        invalid && "border-danger",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-border bg-surface-2/60 px-1.5 pt-1.5" role="tablist">
        {(
          [
            ["write", "Escrever"],
            ["preview", "Visualizar"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "-mb-px h-8 rounded-t-md border border-transparent px-3 text-small font-medium",
              tab === k ? "border-border border-b-surface bg-surface text-fg" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto hidden pr-2 text-caption text-subtle sm:inline">Markdown: **negrito**, _itálico_, listas, [links](https://…)</span>
      </div>
      {tab === "write" ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoFocus={autoFocus}
          className="block w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed text-fg outline-none placeholder:text-subtle"
        />
      ) : (
        <div className="min-h-40 px-3 py-2.5 text-sm">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-subtle">Nada para visualizar ainda.</p>}
        </div>
      )}
    </div>
  );
}
