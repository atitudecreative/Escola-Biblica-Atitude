import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando">
      <Skeleton className="mb-2 h-4 w-28" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 mb-8 h-4 w-full max-w-xl" />
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
