import { CourseCover } from "@/components/course/course-cover";
import { cn } from "@/lib/utils";

/**
 * Miniatura de capa. A arte gerada é desenhada no dobro do tamanho e reduzida,
 * para que o título continue legível como "arte" em tamanhos pequenos.
 */
export function CourseThumb({ title, src, className, width = 80 }: { title: string; src?: string | null; className?: string; width?: number }) {
  return (
    <div className={cn("relative aspect-video shrink-0 overflow-hidden rounded-md bg-surface-3", className)} style={{ width }} aria-hidden>
      {src ? (
        <CourseCover title={title} src={src} size="sm" className="size-full" />
      ) : (
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: width * 2, transform: "scale(0.5)" }}>
          <CourseCover title={title} size="sm" />
        </div>
      )}
    </div>
  );
}
