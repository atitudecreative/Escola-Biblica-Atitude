"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { ProgressRing } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { LessonOutline, type OutlineModule } from "./outline";
import { cn } from "@/lib/utils";

export function LearnShell({
  brand,
  course,
  lessonId,
  outline,
  totals,
  prev,
  next,
  children,
}: {
  brand: { name: string; logoUrl: string | null };
  course: { id: string; slug: string; title: string };
  lessonId: string;
  outline: OutlineModule[];
  totals: { lessons: number; completed: number };
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const nextLocked = next ? outline.some((m) => m.lessons.some((l) => l.id === next.id && l.locked)) : false;
  const pct = totals.lessons ? Math.round((totals.completed / totals.lessons) * 100) : 0;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex h-15 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur-md sm:px-5">
        <Logo name={brand.name} logoUrl={brand.logoUrl} className="shrink-0 [&>span]:h-9" />
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
        <Button asChild variant="ghost" size="sm" className="hidden text-muted sm:inline-flex">
          <Link href={`/courses/${course.slug}`}>
            <ArrowLeft /> Página do curso
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden text-caption text-subtle tabular-nums md:inline">
            {totals.completed} de {totals.lessons} aulas
          </span>
          <ProgressRing value={pct} size={34} stroke={3} className="mr-1 hidden sm:inline-flex" />
          <NavButton href={prev ? `/learn/${course.id}/${prev.id}` : null} label={prev ? `Anterior: ${prev.title}` : "Não há aula anterior"}>
            <ChevronLeft />
          </NavButton>
          <NavButton
            href={next && !nextLocked ? `/learn/${course.id}/${next.id}` : null}
            label={next ? (nextLocked ? "Conclua esta aula para liberar a próxima" : `Próxima: ${next.title}`) : "Não há próxima aula"}
          >
            <ChevronRight />
          </NavButton>
          <Button variant="outline" size="md" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir conteúdo do curso">
            <ListTree /> <span className="hidden sm:inline">Conteúdo</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <main id="conteudo" className="relative isolate min-w-0 flex-1">
          {/* Mesmo fundo decorativo das páginas internas (suave, para não atrapalhar a leitura). */}
          <div aria-hidden className="page-backdrop pointer-events-none absolute inset-0 -z-10 opacity-40" />
          {children}
        </main>
        <aside className="sticky top-15 hidden h-[calc(100dvh-3.75rem)] w-[340px] shrink-0 overflow-y-auto border-l border-border bg-surface lg:block" aria-label="Conteúdo do curso">
          <div className="border-b border-border px-4 py-4">
            <p className="text-overline text-subtle">Curso</p>
            <Link href={`/courses/${course.slug}`} className="mt-1 block text-h4 text-balance hover:text-primary">
              {course.title}
            </Link>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-caption text-subtle">{pct}% concluído</p>
          </div>
          <LessonOutline modules={outline} courseId={course.id} currentId={lessonId} />
        </aside>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" title={course.title} description={`${totals.completed} de ${totals.lessons} aulas · ${pct}% concluído`}>
          <LessonOutline modules={outline} courseId={course.id} currentId={lessonId} onNavigate={() => setOpen(false)} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function NavButton({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  return (
    <Tooltip content={label}>
      {href ? (
        <Button asChild variant="ghost" size="icon">
          <Link href={href} aria-label={label}>{children}</Link>
        </Button>
      ) : (
        <span>
          <Button variant="ghost" size="icon" disabled aria-label={label} className={cn("opacity-40")}>
            {children}
          </Button>
        </span>
      )}
    </Tooltip>
  );
}
