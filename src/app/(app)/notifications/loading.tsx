import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy aria-label="Carregando notificações">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mb-5 flex gap-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-56" />
      </div>
      {[4, 3].map((n, g) => (
        <div key={g} className="mb-6">
          <Skeleton className="mb-2 h-3 w-16" />
          <div className="divide-y divide-border rounded-xl border border-border bg-surface">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3.5">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
