"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type FieldCtx = { id: string; hintId: string; errorId: string; invalid: boolean };
const Ctx = React.createContext<FieldCtx | null>(null);

/**
 * Agrupa label + controle + dica + erro com os atributos ARIA corretos.
 * O primeiro filho elemento recebe id, aria-describedby e aria-invalid.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
  labelAction,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
  labelAction?: React.ReactNode;
}) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const child = React.cloneElement(children, {
    id: (children.props.id as string) ?? id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    required: children.props.required ?? required,
  });
  return (
    <Ctx.Provider value={{ id, hintId, errorId, invalid: !!error }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={(children.props.id as string) ?? id} className="text-small font-medium text-fg">
              {label}
              {required && (
                <span className="ml-0.5 text-danger" aria-hidden>
                  *
                </span>
              )}
            </label>
            {labelAction}
          </div>
        )}
        {child}
        {hint && !error && (
          <p id={hintId} className="text-caption text-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-caption font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useField() {
  return React.useContext(Ctx);
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-small font-medium text-fg", className)} {...props} />;
}
