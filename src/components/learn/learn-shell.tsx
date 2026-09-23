"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { ProgressRing } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { LessonOutline, type OutlineModule } from "./outline";
import { cn } from "@/lib/utils";

export function LearnShell({
  course,
  lessonId,
  outline,
  totals,
  prev,
  next,
  children,
}: {
  course: { id: string; slug: string; title: string };
  lessonId: string;
  outline: OutlineModule[];
  totals: { lessons: number; completed: number };
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pct = totals.lessons ? Math.round((totals.completed / totals.lessons) * 100) : 0;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-2 backdrop-blur-md sm:px-4">
        <Tooltip content="Voltar para a página do curso">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/courses/${course.slug}`} aria-label="Voltar para a página do curso">
              <ArrowLeft />
            </Link>
          </Button>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{course.title}</p>
          <p className="text-caption text-subtle">
            {totals.completed} de {totals.lessons} aulas concluídas
          </p>
        </div>
        <ProgressRing value={pct} size={36} stroke={3} className="hidden sm:inline-flex" />
        <div className="ml-1 flex items-center gap-1">
          <NavButton href={prev ? `/learn/${course.id}/${prev.id}` : null} label={prev ? `Anterior: ${prev.title}` : "Não há aula anterior"}>
            <ChevronLeft />
          </NavButton>
          <NavButton href={next ? `/learn/${course.id}/${next.id}` : null} label={next ? `Próxima: ${next.title}` : "Não há próxima aula"}>
            <ChevronRight />
          </NavButton>
          <Button variant="outline" size="md" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir conteúdo do curso">
            <ListTree /> <span className="hidden sm:inline">Conteúdo</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <main id="conteudo" className="min-w-0 flex-1">{children}</main>
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[340px] shrink-0 overflow-y-auto border-l border-border bg-surface lg:block" aria-label="Conteúdo do curso">
          <div className="border-b border-border px-4 py-4">
            <p className="text-h4">Conteúdo do curso</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-caption text-subtle">{pct}% concluído</p>
          </div>
          <LessonOutline modules={outline} courseId={course.id} currentId={lessonId} />
        </aside>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" title="Conteúdo do curso" description={`${pct}% concluído`}>
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
