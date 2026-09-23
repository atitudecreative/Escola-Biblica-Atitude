import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy aria-label="Carregando discussão">
      <Skeleton className="mb-4 h-3 w-56" />
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="mt-3 h-9 w-4/5" />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <SkeletonText className="mt-6" lines={5} />
      <Skeleton className="mt-8 h-6 w-32" />
      {[0, 1].map((i) => (
        <div key={i} className="mt-3 rounded-xl border border-border bg-surface p-5">
          <div className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-40" />
              <SkeletonText className="mt-3" lines={2} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
