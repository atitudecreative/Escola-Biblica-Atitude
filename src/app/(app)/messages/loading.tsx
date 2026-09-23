import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="hidden h-full items-center justify-center md:flex" aria-busy>
      <Skeleton className="size-12 rounded-full" />
    </div>
  );
}
