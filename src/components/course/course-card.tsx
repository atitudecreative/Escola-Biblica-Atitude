import Link from "next/link";
import { Clock, Star, Users } from "lucide-react";
import { CourseCover } from "./course-cover";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { COURSE_LEVEL } from "@/lib/labels";
import { formatDuration, formatNumber } from "@/lib/format";
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
  category?: { name: string } | null;
  instructor: { name: string };
  progress?: number | null; // se matriculado
  completed?: boolean;
};

export function CourseCard({ course, className, href }: { course: CourseCardData; className?: string; href?: string }) {
  const enrolled = course.progress != null;
  return (
    <Link
      href={href ?? `/courses/${course.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xs transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
        className,
      )}
    >
      <div className="relative overflow-hidden">
        <CourseCover title={course.title} category={course.category?.name} src={course.coverUrl} className="transition-transform duration-500 group-hover:scale-[1.02]" />
        {course.completed && (
          <Badge tone="success" className="absolute top-3 left-3 bg-surface/95">
            Concluído
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-h4 text-fg transition-colors group-hover:text-primary">{course.title}</h3>
        <p className="mt-1 truncate text-small text-muted">{course.instructor.name}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-subtle">
          {course.ratingCount > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-fg">
              <Star className="size-3.5 fill-accent text-accent" aria-hidden />
              {formatNumber(course.ratingAvg, 1)}
              <span className="font-normal text-subtle">({course.ratingCount})</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatDuration(course.durationMinutes * 60)}
          </span>
          <span>{COURSE_LEVEL[course.level]}</span>
          {course.enrollmentCount != null && course.enrollmentCount > 0 && !enrolled && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {formatNumber(course.enrollmentCount)}
            </span>
          )}
        </div>
        {enrolled && (
          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex justify-between text-caption">
              <span className="text-muted">{course.completed ? "Concluído" : "Seu progresso"}</span>
              <span className="font-medium tabular-nums">{course.progress}%</span>
            </div>
            <Progress value={course.progress ?? 0} tone={course.completed ? "success" : "primary"} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="skeleton aspect-[16/9] rounded-none" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton mt-4 h-3 w-2/3" />
      </div>
    </div>
  );
}
