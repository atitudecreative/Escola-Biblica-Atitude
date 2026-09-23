"use client";
import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

/** Filtro de período (?from=AAAA-MM-DD&to=AAAA-MM-DD) sincronizado com a URL. */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  function set(key: "from" | "to", v: string) {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(key, v);
    else sp.delete(key);
    sp.delete("page");
    start(() => router.replace(`${pathname}?${sp}`, { scroll: false }));
  }
  return (
    <div className="flex items-center gap-2">
      <Input type="date" aria-label="De" value={params.get("from") ?? ""} max={params.get("to") ?? undefined} onChange={(e) => set("from", e.target.value)} className="sm:w-40" />
      <span className="text-small text-subtle">até</span>
      <Input type="date" aria-label="Até" value={params.get("to") ?? ""} min={params.get("from") ?? undefined} onChange={(e) => set("to", e.target.value)} className="sm:w-40" />
    </div>
  );
}
