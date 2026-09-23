import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong text-center",
        compact ? "px-6 py-8" : "px-6 py-14",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted ring-8 ring-surface-2/50">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-h4 text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-small text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
