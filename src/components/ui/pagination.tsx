import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

/** Paginação baseada em URL (?page=). Funciona sem JavaScript. */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const window = pagesWindow(page, pages);
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-small font-medium transition-colors";
  return (
    <nav aria-label="Paginação" className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}>
      <p className="text-small text-muted">
        {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)}
      </p>
      <div className="flex items-center gap-1">
        <PageLink disabled={page <= 1} href={hrefFor(page - 1)} className={btn} label="Página anterior">
          <ChevronLeft className="size-4" />
        </PageLink>
        {window.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-subtle">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={hrefFor(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(btn, p === page ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg")}
            >
              {p}
            </Link>
          ),
        )}
        <PageLink disabled={page >= pages} href={hrefFor(page + 1)} className={btn} label="Próxima página">
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({ disabled, href, className, label, children }: { disabled: boolean; href: string; className: string; label: string; children: React.ReactNode }) {
  if (disabled)
    return (
      <span aria-disabled className={cn(className, "text-subtle opacity-40")} aria-label={label}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={cn(className, "text-muted hover:bg-surface-2 hover:text-fg")} aria-label={label}>
      {children}
    </Link>
  );
}

function pagesWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pages - 1) out.push("…");
  out.push(pages);
  return out;
}
