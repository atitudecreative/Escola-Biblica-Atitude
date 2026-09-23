import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BadgeCell, Cell, Column, ReportRow } from "@/server/services/reports";

const numeric = new Set(["number", "percent", "duration", "decimal"]);

export function renderCell(v: Cell | string | undefined, type: Column["type"] = "text") {
  if (v == null || v === "") return <span className="text-subtle">—</span>;
  if (typeof v === "object" && !(v instanceof Date)) {
    const b = v as BadgeCell;
    return <Badge tone={b.tone}>{b.label}</Badge>;
  }
  if (v instanceof Date) return type === "date" ? formatDate(v, "dd/MM/yyyy") : formatDate(v, "dd/MM/yy HH:mm");
  if (typeof v === "number") {
    if (type === "percent") return `${formatNumber(v)}%`;
    if (type === "duration") return v ? formatDuration(v) : <span className="text-subtle">—</span>;
    if (type === "decimal") return formatNumber(v, 1);
    return formatNumber(v);
  }
  return v;
}

export function ReportTable({ columns, rows, linkRows }: { columns: Column[]; rows: ReportRow[]; linkRows: boolean }) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.find((c) => c.secondary);
  const rest = columns.filter((c) => c !== primary && c !== secondary && !c.hideMobile);
  const title = (r: ReportRow) => {
    const content = renderCell(r[primary.key], primary.type);
    return linkRows && r.href ? (
      <Link href={r.href} className="font-medium text-fg hover:underline">{content}</Link>
    ) : (
      <span className="font-medium text-fg">{content}</span>
    );
  };
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block print:block">
        <Table>
          <THead>
            <tr>
              {columns.map((c) => (
                <TH key={c.key} className={cn(numeric.has(c.type ?? "") && "text-right")}>{c.label}</TH>
              ))}
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                {columns.map((c) => (
                  <TD key={c.key} className={cn("h-12 text-small", numeric.has(c.type ?? "") && "text-right tabular-nums", c === primary ? "max-w-[16rem] truncate" : "max-w-[14rem] truncate text-muted")}>
                    {c === primary ? title(r) : renderCell(r[c.key], c.type)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:hidden print:hidden">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{title(r)}</p>
                {secondary && <p className="truncate text-caption text-muted">{renderCell(r[secondary.key], secondary.type)}</p>}
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {rest.slice(0, 6).map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="truncate text-caption text-subtle">{c.label}</dt>
                  <dd className="truncate text-small text-fg tabular-nums">{renderCell(r[c.key], c.type)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
