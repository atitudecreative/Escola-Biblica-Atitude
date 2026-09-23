import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando" className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
