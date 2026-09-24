"use client";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Icon } from "@/components/icon";
import type { ShowcaseCourse } from "@/server/services/catalog";
import { cn } from "@/lib/utils";
import { CourseShowcase } from "./course-showcase";

type Area = { slug: string; name: string; icon: string | null; count: number };

/** "Explore por área": filtro por categoria sobre o catálogo real, sem sair da Home. */
export function CategoryExplorer({ areas, courses, total, loggedIn }: { areas: Area[]; courses: ShowcaseCourse[]; total: number; loggedIn: boolean }) {
  const [area, setArea] = useState<string | null>(null);
  const uid = useId();
  const visible = useMemo(() => (area ? courses.filter((c) => c.category?.slug === area) : courses).slice(0, 8), [area, courses]);
  const current = areas.find((a) => a.slug === area);
  const seeAll = current ? `/courses?category=${current.slug}` : "/courses";

  return (
    <div>
      <div role="group" aria-label="Filtrar por área" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <Chip active={!area} onClick={() => setArea(null)} label="Todas as áreas" count={total} />
        {areas.map((a) => (
          <Chip key={a.slug} active={area === a.slug} onClick={() => setArea(a.slug)} label={a.name} count={a.count} icon={a.icon} />
        ))}
      </div>

      <div className="mt-6" aria-live="polite">
        <CourseShowcase key={area ?? "all"} courses={visible} loggedIn={loggedIn} idPrefix={`explore${uid.replace(/:/g, "")}`} className="animate-fade-in" />
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href={seeAll}
          className="group inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-medium text-fg transition-[border-color,background-color] hover:border-border-strong hover:bg-surface-2"
        >
          {current ? `Ver todos os cursos de ${current.name}` : `Ver o catálogo completo`}
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function Chip({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count: number; icon?: string | null }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap outline-none transition-[background-color,border-color,color] duration-200",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        active ? "border-fg bg-fg text-bg" : "border-border bg-surface text-muted hover:border-border-strong hover:text-fg",
      )}
    >
      {icon && <Icon name={icon} className={cn("size-4 transition-transform duration-200", !active && "group-hover:-rotate-6")} />}
      {label}
      <span className={cn("text-caption tabular-nums", active ? "text-bg/70" : "text-subtle")}>{count}</span>
    </button>
  );
}
