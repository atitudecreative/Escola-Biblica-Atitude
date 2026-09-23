"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Barra de salvar fixa no rodapé do formulário: aparece destacada quando
 * há alterações não salvas.
 */
export function SaveBar({
  dirty,
  pending,
  onReset,
  label = "Salvar alterações",
  className,
}: {
  dirty: boolean;
  pending: boolean;
  onReset: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "z-30 mt-6 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
        dirty ? "sticky bottom-20 border-border-strong bg-surface shadow-md md:bottom-4" : "border-border bg-surface-2",
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-small text-muted" aria-live="polite">
        {dirty ? (
          <span className="inline-flex items-center gap-2 font-medium text-fg">
            <span className="size-2 rounded-full bg-warning" aria-hidden />
            Alterações não salvas
          </span>
        ) : (
          "Tudo salvo"
        )}
      </p>
      {dirty && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={pending}>
          Descartar
        </Button>
      )}
      <Button type="submit" size="sm" loading={pending} disabled={!dirty}>
        {label}
      </Button>
    </div>
  );
}
