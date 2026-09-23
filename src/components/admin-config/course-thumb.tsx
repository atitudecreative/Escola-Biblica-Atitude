import { CourseCover } from "@/components/course/course-cover";
import { cn } from "@/lib/utils";

/** Miniatura de capa para listas densas: esconde o título gerado (ilegível em tamanhos pequenos). */
export function CourseThumb({ title, src, className }: { title: string; src?: string | null; className?: string }) {
  return (
    <CourseCover
      title={title}
      src={src}
      size="sm"
      className={cn("shrink-0 rounded-md ring-1 ring-border [&>div:last-child]:hidden", className)}
    />
  );
}
