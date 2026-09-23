import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando painel">
      <Skeleton className="mb-2 h-3 w-16" />
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-8 h-4 w-80 max-w-full" />
      <Skeleton className="mb-6 h-16 w-full rounded-xl" />
      <Skeleton className="mb-6 h-24 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
