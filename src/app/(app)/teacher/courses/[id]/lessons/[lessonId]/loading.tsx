import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando aula">
      <Skeleton className="mb-3 h-3 w-72 max-w-full" />
      <Skeleton className="mb-2 h-8 w-80 max-w-full" />
      <Skeleton className="mb-8 h-6 w-48" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-60 rounded-xl" />
      </div>
    </div>
  );
}
