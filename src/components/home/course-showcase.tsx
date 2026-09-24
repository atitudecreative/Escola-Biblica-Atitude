"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BarChart3, Volume2, VolumeX } from "lucide-react";
import { CourseCard } from "@/components/course/course-card";
import { CourseCover } from "@/components/course/course-cover";
import { EnrollButton } from "@/components/course/course-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ShowcaseCourse } from "@/server/services/catalog";
import { COURSE_LEVEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Vitrine de cursos da Home. O card leva direto à página do curso; com mouse, uma pausa
 * sobre ele abre a prévia ampliada (vídeo da aula, detalhes e inscrição).
 */
export function CourseShowcase({
  courses,
  loggedIn,
  className,
}: {
  courses: ShowcaseCourse[];
  loggedIn: boolean;
  /** Mantido por compatibilidade com as chamadas existentes. */
  idPrefix?: string;
  className?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={gridRef} className={cn("grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {courses.map((c) => (
        <HoverShell key={c.id} course={c} loggedIn={loggedIn} gridRef={gridRef}>
          <CourseCard
            course={{
              ...c,
              instructor: c.instructor,
              progress: c.enrollment !== "none" ? (c.progress ?? 0) : null,
              completed: c.enrollment === "completed",
            }}
            className="h-full"
          />
        </HoverShell>
      ))}
    </div>
  );
}

export function ShowcaseSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[16/9] rounded-xl" />
          <div className="skeleton mt-4 h-4 w-4/5" />
          <div className="skeleton mt-2 h-3 w-1/2" />
          <div className="skeleton mt-3 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// ── Prévia ao passar o mouse ───────────────────────────────────────

const canHover = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * Envolve o card: após uma pausa curta do mouse, abre por cima dele um cartão maior que
 * "cresce" a partir do próprio card e toca, sem som, a prévia da aula. Só em dispositivos
 * com mouse — no toque e no teclado vale o painel expandido do clique.
 */
function HoverShell({
  course,
  loggedIn,
  gridRef,
  children,
}: {
  course: ShowcaseCourse;
  loggedIn: boolean;
  gridRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PreviewPos | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Tamanho e posição (calculados no evento): ~1,45× o card, centrado nele e contido na grade.
  const measure = (): PreviewPos | null => {
    if (!ref.current || !gridRef.current) return null;
    const a = ref.current.getBoundingClientRect();
    const g = gridRef.current.getBoundingClientRect();
    const width = Math.round(Math.min(Math.max(a.width * 1.45, 380), 560, g.width));
    const left = Math.max(g.left - a.left, Math.min((a.width - width) / 2, g.right - a.left - width));
    // Cabe na janela: se passaria do rodapé, sobe o necessário (sem subir para baixo do cabeçalho fixo).
    const est = (width * 9) / 16 + 330;
    let top = -24;
    if (a.top + top + est > window.innerHeight - 12) top = Math.max(72 - a.top, window.innerHeight - 12 - est - a.top);
    return { left, top, width, origin: `${a.width / 2 - left}px ${Math.max(0, -top) + 80}px`, scale: a.width / width };
  };

  return (
    <div
      ref={ref}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || !canHover()) return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPos(measure()), 380);
      }}
      onPointerLeave={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPos(null), 120);
      }}
    >
      {children}
      {pos && <HoverPreview course={course} loggedIn={loggedIn} pos={pos} />}
    </div>
  );
}

type PreviewPos = { left: number; top: number; width: number; origin: string; scale: number };

function hoursLabel(min: number) {
  return min >= 60 ? `${Math.round(min / 60)}h` : `${min}min`;
}

function HoverPreview({ course, loggedIn, pos }: { course: ShowcaseCourse; loggedIn: boolean; pos: PreviewPos }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced] = useState(prefersReducedMotion);

  // Cresce a partir do tamanho do card (escala inicial = card/prévia).
  useLayoutEffect(() => {
    if (!boxRef.current || reduced) return;
    boxRef.current.animate(
      [
        { transform: `scale(${pos.scale})`, opacity: 0.5 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 300, easing: EASE },
    );
  }, [pos.scale, reduced]);

  // O React não aplica o atributo `muted` a tempo do autoplay: garante mudo e dá o play na montagem.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const p = course.preview;
  const meta = ["Curso", hoursLabel(course.durationMinutes), course.year].filter(Boolean).join(" · ");
  const chips = [course.category?.name, ...course.tags].filter((x): x is string => !!x).slice(0, 4);

  return (
    <div
      ref={boxRef}
      className="absolute z-30 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
      style={{ left: pos.left, top: pos.top, width: pos.width, transformOrigin: pos.origin }}
    >
      <Link href={`/courses/${course.slug}`} className="relative block w-full" aria-label={`Ver detalhes de ${course.title}`}>
        <CourseCover title={course.title} category={course.category?.name} tone={course.category?.position} src={course.coverUrl} size="lg" />
        {p && !reduced && (
          <div className={cn("absolute inset-0 bg-black transition-opacity duration-500", playing ? "opacity-100" : "opacity-0")}>
            {p.kind === "video" ? (
              <video
                ref={videoRef}
                className="size-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onPlaying={() => setPlaying(true)}
              >
                {p.webm && <source src={p.webm} type="video/webm" />}
                <source src={p.src} />
              </video>
            ) : (
              <iframe
                src={p.src}
                title={`Prévia: ${p.lessonTitle}`}
                className="pointer-events-none size-full"
                allow="autoplay; encrypted-media"
                onLoad={() => window.setTimeout(() => setPlaying(true), 600)}
              />
            )}
          </div>
        )}
        <span className="absolute top-3 right-3 rounded-md bg-black/70 px-2 py-1 text-[0.6875rem] font-semibold tracking-wide text-white uppercase">
          {course.enrollment === "completed" ? "Concluído" : course.enrollment === "active" ? "Inscrito" : course.paid ? "Pago" : "Gratuito"}
        </span>
        {p && playing && (
          <span className="absolute bottom-3 left-3 max-w-[70%] truncate rounded-md bg-black/60 px-2 py-1 text-caption text-white">
            Prévia · {p.lessonTitle}
          </span>
        )}
      </Link>

      <div className="relative p-5">
        {p?.kind === "video" && playing && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Ativar som da prévia" : "Tirar o som da prévia"}
            className="absolute -top-14 right-3 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-md transition-transform hover:scale-105"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        )}
        <p className="text-h3 leading-tight">{course.title}</p>
        {course.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{course.excerpt}</p>}
        <div className="mt-3 flex items-center gap-2">
          <Avatar name={course.instructor.name} src={course.instructor.avatarUrl} size="xs" />
          <span className="truncate text-small text-muted">{course.instructor.name}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-caption font-medium tracking-wide text-subtle uppercase">
          <span>{meta}</span>
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="size-3.5 text-primary" aria-hidden />
            {COURSE_LEVEL[course.level]}
          </span>
        </div>
        {chips.length > 0 && (
          <ul className="mt-3 flex gap-1.5 overflow-hidden">
            {chips.map((c) => (
              <li key={c} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-caption font-medium text-muted">
                {c}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button asChild variant="secondary">
            <Link href={`/courses/${course.slug}`}>Detalhes</Link>
          </Button>
          <EnrollButton
            courseId={course.id}
            slug={course.slug}
            state={course.enrollment}
            continueHref={`/learn/${course.id}`}
            loggedIn={loggedIn}
            paid={course.paid}
            size="md"
          />
        </div>
      </div>
    </div>
  );
}
