import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true" aria-label="Carregando aula">
      <div className="h-14 border-b border-border bg-surface" />
      <div className="flex flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-3 h-8 w-80 max-w-full" />
          <Skeleton className="mt-6 aspect-video w-full rounded-xl" />
        </div>
        <div className="hidden w-[340px] border-l border-border bg-surface lg:block" />
      </div>
    </div>
  );
}
