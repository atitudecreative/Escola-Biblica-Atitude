import Link from "next/link";
import { Star } from "lucide-react";
import { CourseCover } from "./course-cover";
import { Progress } from "@/components/ui/progress";
import { formatMoney, formatNumber, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CourseLevel } from "@prisma/client";

export type CourseCardData = {
  slug: string;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  level: CourseLevel;
  durationMinutes: number;
  ratingAvg: number;
  ratingCount: number;
  enrollmentCount?: number;
  category?: { name: string; position?: number } | null;
  instructor: { name: string };
  progress?: number | null; // se matriculado
  completed?: boolean;
  /** Preço em centavos (0 = gratuito). Ausente = não exibe preço. */
  priceCents?: number;
  /** Selo de dados reais: "Mais procurado" ou "Novo" (ver `withBadges`). */
  badge?: string | null;
};

/**
 * Card de curso no formato de vitrine: capa, título forte, professor, selos
 * (destaque · nota · avaliações) e preço — ou o progresso, para quem já está inscrito.
 */
export function CourseCard({ course, className, href }: { course: CourseCardData; className?: string; href?: string }) {
  const enrolled = course.progress != null;
  return (
    <Link
      href={href ?? `/courses/${course.slug}`}
      className={cn(
        "group flex flex-col rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-bg",
        className,
      )}
    >
      <div data-cover className="relative overflow-hidden rounded-xl bg-surface-3 ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-md">
        <CourseCover
          title={course.title}
          category={course.category?.name}
          tone={course.category?.position}
          src={course.coverUrl}
          className="transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <h3 className="line-clamp-2 text-[1.0625rem] leading-snug font-semibold tracking-tight text-fg transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        <p className="mt-1 truncate text-small text-muted">{course.instructor.name}</p>

        {(course.badge || course.ratingCount > 0 || course.completed) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {course.completed ? (
              <span className="rounded-md bg-success-soft px-2 py-1 text-caption font-semibold text-success">Concluído</span>
            ) : (
              course.badge && <span className="rounded-md bg-primary-soft px-2 py-1 text-caption font-semibold text-primary-soft-fg">{course.badge}</span>
            )}
            {course.ratingCount > 0 && (
              <>
                <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-caption font-medium text-fg">
                  <Star className="size-3.5 fill-accent text-accent" aria-hidden />
                  {formatNumber(course.ratingAvg, 1)}
                  <span className="sr-only"> de 5</span>
                </span>
                <span className="rounded-md border border-border px-2 py-0.5 text-caption text-muted">
                  {pluralize(course.ratingCount, "avaliação", "avaliações")}
                </span>
              </>
            )}
          </div>
        )}

        <div className="mt-auto pt-3">
          {enrolled ? (
            <div className="flex items-center gap-2.5">
              <Progress value={course.progress ?? 0} tone={course.completed ? "success" : "primary"} size="sm" className="flex-1" />
              <span className="text-caption font-medium text-muted tabular-nums">{course.progress}%</span>
            </div>
          ) : course.priceCents != null ? (
            <p className="text-h4 font-semibold tabular-nums">{course.priceCents > 0 ? formatMoney(course.priceCents) : "Gratuito"}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function CourseCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[16/9] rounded-xl" />
      <div className="space-y-2 pt-3">
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton mt-3 h-6 w-2/3" />
        <div className="skeleton mt-3 h-5 w-1/4" />
      </div>
    </div>
  );
}
