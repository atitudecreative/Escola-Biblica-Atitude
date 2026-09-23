import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando cursos">
      <Skeleton className="mb-3 h-3 w-40" />
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-72 max-w-full" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border p-3 last:border-0">
            <Skeleton className="aspect-video w-20 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
