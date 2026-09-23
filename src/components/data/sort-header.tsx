import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TH } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Cabeçalho ordenável via URL (?sort=campo&dir=asc|desc). */
export function SortHeader({
  label,
  field,
  searchParams,
  className,
}: {
  label: string;
  field: string;
  searchParams: Record<string, string | string[] | undefined>;
  className?: string;
}) {
  const current = searchParams.sort === field;
  const dir = current && searchParams.dir === "asc" ? "desc" : "asc";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && k !== "page") sp.set(k, v);
  sp.set("sort", field);
  sp.set("dir", dir);
  const Icon = !current ? ArrowUpDown : searchParams.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TH className={className} aria-sort={current ? (searchParams.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={`?${sp.toString()}`} scroll={false} className={cn("inline-flex items-center gap-1 hover:text-fg", current && "text-fg")}>
        {label}
        <Icon className="size-3.5 opacity-60" />
      </Link>
    </TH>
  );
}

export function buildHref(searchParams: Record<string, string | string[] | undefined>, patch: Record<string, string | number | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string") sp.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "?";
}

export function pageParam(sp: Record<string, string | string[] | undefined>) {
  const n = Number(sp.page);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function strParam(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key];
  return typeof v === "string" && v.length <= 200 ? v : undefined;
}
