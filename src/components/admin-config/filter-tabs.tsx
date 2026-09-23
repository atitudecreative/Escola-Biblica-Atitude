import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

/** Abas de filtro baseadas em URL (ex.: ?status=REVIEW), com contagem opcional. */
export function FilterTabs({
  items,
  className,
  label = "Filtrar",
}: {
  items: { label: string; href: string; active: boolean; count?: number }[];
  className?: string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0", className)}>
      <ul className="flex min-w-max gap-1 border-b border-border">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              scroll={false}
              aria-current={it.active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium transition-colors",
                "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
                it.active ? "text-fg after:bg-primary" : "text-muted hover:text-fg after:bg-transparent",
              )}
            >
              {it.label}
              {it.count != null && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums",
                    it.active ? "bg-primary-soft text-primary-soft-fg" : "bg-surface-2 text-subtle",
                  )}
                >
                  {formatNumber(it.count)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
