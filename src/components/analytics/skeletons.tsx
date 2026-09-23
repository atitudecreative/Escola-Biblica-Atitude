import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton({ withAlerts }: { withAlerts?: boolean }) {
  return (
    <div aria-busy aria-label="Carregando indicadores">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 mb-8 h-4 w-full max-w-xl" />
      {withAlerts && <Skeleton className="mb-6 h-28 w-full rounded-xl" />}
      <Skeleton className="mb-6 h-9 w-full max-w-md rounded-lg" />
      <Skeleton className="mb-6 h-28 w-full rounded-xl" />
      <Skeleton className="mb-6 h-20 w-full rounded-xl" />
      <Skeleton className="mb-6 h-[360px] w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8, label = "Carregando" }: { rows?: number; label?: string }) {
  return (
    <div aria-busy aria-label={label}>
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-2 mb-8 h-4 w-full max-w-lg" />
      <Skeleton className="mb-4 h-10 w-full max-w-2xl" />
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy aria-label="Carregando perfil">
      <Skeleton className="mb-4 h-4 w-48" />
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <Skeleton className="mb-6 h-24 w-full rounded-xl" />
      <Skeleton className="mb-4 h-10 w-full max-w-lg" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
