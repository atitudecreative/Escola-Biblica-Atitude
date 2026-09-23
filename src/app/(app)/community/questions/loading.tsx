import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando comunidade">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-9 sm:w-72" />
        <Skeleton className="h-9 sm:w-40" />
        <Skeleton className="h-9 sm:w-40" />
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-5 py-4">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
