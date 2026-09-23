import * as React from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

/**
 * Cabeçalho padrão de página: contexto (breadcrumbs/eyebrow) → título →
 * descrição → ação principal. Mantém a hierarquia consistente em todo o app.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  eyebrow,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  eyebrow?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("mb-6 sm:mb-8", className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-3" />}
      {eyebrow && <div className="mb-2 text-overline text-primary">{eyebrow}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-h1 text-balance text-fg">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-h3 text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-small text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
