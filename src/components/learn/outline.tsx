import Link from "next/link";
import { CircleCheck, Lock, EyeOff } from "lucide-react";
import type { LessonType } from "@prisma/client";
import { LessonTypeIcon } from "@/components/course/lesson-type-icon";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export type OutlineModule = {
  id: string;
  title: string;
  lessons: { id: string; title: string; type: LessonType; durationSeconds: number; completed: boolean; locked: boolean; isPublished: boolean }[];
};

export function LessonOutline({ modules, courseId, currentId, onNavigate }: { modules: OutlineModule[]; courseId: string; currentId: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Conteúdo do curso" className="pb-6">
      {modules.map((m, mi) => {
        const done = m.lessons.filter((l) => l.completed).length;
        return (
          <section key={m.id} className="border-b border-border last:border-0">
            <div className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2">
              <h3 className="text-small font-semibold text-fg">
                <span className="mr-1.5 text-subtle">{mi + 1}.</span>
                {m.title}
              </h3>
              <span className="shrink-0 text-caption tabular-nums text-subtle">{done}/{m.lessons.length}</span>
            </div>
            <ul className="pb-2">
              {m.lessons.map((l) => {
                const current = l.id === currentId;
                return (
                  <li key={l.id}>
                    <Link
                      href={`/learn/${courseId}/${l.id}`}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "relative flex items-start gap-3 px-4 py-2.5 text-small transition-colors",
                        current ? "bg-primary-soft/70 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      {current && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-primary" aria-hidden />}
                      <span className="mt-0.5 shrink-0">
                        {l.completed ? (
                          <CircleCheck className="size-4 text-success" aria-label="Concluída" />
                        ) : l.locked ? (
                          <Lock className="size-4 text-subtle" aria-label="Bloqueada" />
                        ) : (
                          <LessonTypeIcon type={l.type} className={cn("size-4", current ? "text-primary" : "text-subtle")} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("line-clamp-2", current && "font-medium")}>{l.title}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-caption text-subtle">
                          {formatDuration(l.durationSeconds)}
                          {!l.isPublished && (
                            <span className="inline-flex items-center gap-1"><EyeOff className="size-3" /> não publicada</span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
