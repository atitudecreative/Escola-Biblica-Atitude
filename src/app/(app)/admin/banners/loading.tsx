import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando">
      <Skeleton className="mb-2 h-4 w-28" />
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-2 mb-8 h-4 w-full max-w-lg" />
      <Skeleton className="mb-6 h-10 w-72" />
      <div className="max-w-4xl space-y-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
