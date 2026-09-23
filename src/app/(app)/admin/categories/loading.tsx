import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando">
      <Skeleton className="mb-2 h-4 w-28" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 mb-8 h-4 w-full max-w-lg" />
      <Skeleton className="mb-6 h-10 w-64" />
      <div className="max-w-3xl space-y-2 rounded-xl border border-border bg-surface p-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
