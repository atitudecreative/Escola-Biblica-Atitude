import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full flex-col" aria-busy aria-label="Carregando conversa">
      <div className="flex h-15 items-center gap-3 border-b border-border bg-surface px-5">
        <Skeleton className="size-8 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex-1 space-y-4 px-6 py-6">
        {["w-3/5", "w-2/5", "w-2/3", "w-1/3", "w-1/2"].map((w, i) => (
          <div key={i} className={i % 2 ? "flex justify-end" : "flex gap-2"}>
            {!(i % 2) && <Skeleton className="size-8 rounded-full" />}
            <Skeleton className={`h-10 rounded-2xl ${w}`} />
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-surface p-3">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
