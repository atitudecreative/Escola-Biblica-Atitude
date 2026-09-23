import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando correção">
      <Skeleton className="mb-3 h-3 w-56" />
      <Skeleton className="mb-2 h-8 w-72 max-w-full" />
      <Skeleton className="mb-8 h-5 w-48" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
