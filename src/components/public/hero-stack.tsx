import Link from "next/link";
import { Star } from "lucide-react";
import { CourseCover } from "@/components/course/course-cover";
import type { CatalogCourse } from "@/server/services/catalog";
import { formatNumber } from "@/lib/format";

/** Composição visual do hero: cursos em destaque sobrepostos, como uma estante. */
export function HeroStack({ courses }: { courses: CatalogCourse[] }) {
  const [a, b, c] = courses;
  if (!a) return null;
  return (
    <div className="relative mx-auto h-[420px] max-w-md">
      {c && (
        <div className="absolute top-2 right-0 w-[58%] rotate-[5deg] overflow-hidden rounded-xl border border-border bg-surface opacity-80 shadow-md">
          <CourseCover title={c.title} category={c.category?.name} tone={c.category?.position} src={c.coverUrl} size="sm" />
        </div>
      )}
      {b && (
        <div className="absolute top-16 left-0 w-[62%] -rotate-[4deg] overflow-hidden rounded-xl border border-border bg-surface shadow-md">
          <CourseCover title={b.title} category={b.category?.name} tone={b.category?.position} src={b.coverUrl} size="sm" />
        </div>
      )}
      <Link href={`/courses/${a.slug}`} className="absolute right-6 bottom-0 left-10 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg transition hover:-translate-y-1">
        <CourseCover title={a.title} category={a.category?.name} tone={a.category?.position} src={a.coverUrl} />
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-h4">{a.title}</p>
            <p className="truncate text-small text-muted">{a.instructor.name}</p>
          </div>
          {a.ratingCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 text-small font-semibold">
              <Star className="size-4 fill-accent text-accent" /> {formatNumber(a.ratingAvg, 1)}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
