"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, Clock, PlayCircle, Star, Users, X } from "lucide-react";
import { CourseCover } from "@/components/course/course-cover";
import { EnrollButton } from "@/components/course/course-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ShowcaseCourse } from "@/server/services/catalog";
import { COURSE_LEVEL } from "@/lib/labels";
import { formatDuration, formatNumber, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Quantas colunas a grade tem agora (lido do CSS, então acompanha os breakpoints). */
function useGridColumns(ref: React.RefObject<HTMLElement | null>) {
  const [cols, setCols] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setCols(Math.max(1, getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}

type Origin = { rect: DOMRect; node: HTMLElement };

/**
 * Vitrine de cursos. Clicar num card não troca de página: o card "se abre" num painel
 * de detalhes logo abaixo da sua linha (no celular, no lugar do próprio card). A capa
 * voa do card até o painel (FLIP com Web Animations), a altura do painel cresce e o
 * resto da página desce junto. Ctrl/⌘+clique e JS desligado continuam abrindo a página do curso.
 */
export function CourseShowcase({
  courses,
  loggedIn,
  idPrefix,
  className,
}: {
  courses: ShowcaseCourse[];
  loggedIn: boolean;
  idPrefix: string;
  className?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridColumns(gridRef);
  const [openId, setOpenId] = useState<string | null>(null);
  const origin = useRef<Origin | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  const openIndex = openId ? courses.findIndex((c) => c.id === openId) : -1;
  const rowEnd = openIndex < 0 ? -1 : Math.min(courses.length - 1, Math.floor(openIndex / cols) * cols + cols - 1);
  const column = openIndex < 0 ? 0 : openIndex % cols;

  const focusCard = useCallback(
    (id: string) => requestAnimationFrame(() => document.getElementById(`${idPrefix}-card-${id}`)?.focus({ preventScroll: true })),
    [idPrefix],
  );

  const close = useCallback(() => {
    const id = openId;
    const wrap = panelRef.current;
    if (!id) return;
    if (!wrap || prefersReducedMotion() || closing.current) {
      setOpenId(null);
      focusCard(id);
      return;
    }
    closing.current = true;
    const h = wrap.offsetHeight;
    const anim = wrap.animate(
      [
        { height: `${h}px`, opacity: 1 },
        { height: "0px", opacity: 0 },
      ],
      { duration: 280, easing: EASE },
    );
    anim.onfinish = () => {
      closing.current = false;
      setOpenId(null);
      focusCard(id);
    };
  }, [openId, focusCard]);

  const onCardClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // abrir em nova aba etc.
    e.preventDefault();
    if (openId === id) return close();
    const cover = e.currentTarget.querySelector<HTMLElement>("[data-cover]");
    origin.current = cover ? { rect: cover.getBoundingClientRect(), node: cover } : null;
    setOpenId(id);
  };

  // Abertura: cresce a altura e faz a capa voar do card para o painel.
  useLayoutEffect(() => {
    const wrap = panelRef.current;
    if (!openId || !wrap) return;
    const target = wrap.querySelector<HTMLElement>("[data-cover-target]");
    const title = wrap.querySelector<HTMLElement>("[data-panel-title]");
    const from = origin.current;
    origin.current = null;
    const reduced = prefersReducedMotion();

    if (!reduced) {
      const h = wrap.scrollHeight;
      wrap.animate(
        [
          { height: "0px", opacity: 0.4 },
          { height: `${h}px`, opacity: 1 },
        ],
        { duration: 420, easing: EASE },
      );
      wrap.querySelectorAll<HTMLElement>("[data-stagger]").forEach((el, i) => {
        el.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 360, delay: 120 + i * 45, easing: EASE, fill: "backwards" },
        );
      });
    }

    let clone: HTMLElement | null = null;
    if (!reduced && from && target) {
      const to = target.getBoundingClientRect();
      const s = to.width / from.rect.width;
      clone = from.node.cloneNode(true) as HTMLElement;
      Object.assign(clone.style, {
        position: "fixed",
        left: `${from.rect.left}px`,
        top: `${from.rect.top}px`,
        width: `${from.rect.width}px`,
        height: `${from.rect.height}px`,
        margin: "0",
        zIndex: "60",
        pointerEvents: "none",
        transformOrigin: "0 0",
        borderRadius: "0.75rem",
        overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
      });
      document.body.appendChild(clone);
      target.style.opacity = "0";
      const fly = clone.animate(
        [
          { transform: "translate(0, 0) scale(1)" },
          { transform: `translate(${to.left - from.rect.left}px, ${to.top - from.rect.top}px) scale(${s})` },
        ],
        { duration: 460, easing: EASE, fill: "forwards" },
      );
      fly.onfinish = () => {
        target.style.opacity = "";
        target.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 160 });
        clone?.remove();
        clone = null;
      };
    }

    title?.focus({ preventScroll: true });
    const t = window.setTimeout(() => {
      const r = wrap.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 16 || r.top < 72) {
        wrap.scrollIntoView({ block: r.height > window.innerHeight - 120 ? "start" : "nearest", behavior: reduced ? "auto" : "smooth" });
      }
    }, reduced ? 0 : 440);

    return () => {
      window.clearTimeout(t);
      clone?.remove();
      if (target) target.style.opacity = "";
    };
  }, [openId]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);

  const open = openIndex >= 0 ? courses[openIndex] : null;
  const panel = open && (
    <div key={`panel-${open.id}`} ref={panelRef} className="col-span-full scroll-mt-20 overflow-hidden">
      <CoursePanel
        course={open}
        loggedIn={loggedIn}
        id={`${idPrefix}-panel`}
        caret={cols > 1 ? `${((column + 0.5) / cols) * 100}%` : null}
        onClose={close}
      />
    </div>
  );

  return (
    <div ref={gridRef} className={cn("grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {courses.map((c, i) => {
        if (cols === 1 && i === openIndex) return panel;
        return [
          <ShowcaseCard
            key={c.id}
            id={`${idPrefix}-card-${c.id}`}
            course={c}
            selected={c.id === openId}
            dimmed={openId !== null && c.id !== openId}
            controls={`${idPrefix}-panel`}
            onClick={(e) => onCardClick(e, c.id)}
          />,
          cols > 1 && i === rowEnd ? panel : null,
        ];
      })}
    </div>
  );
}

function ShowcaseCard({
  id,
  course,
  selected,
  dimmed,
  controls,
  onClick,
}: {
  id: string;
  course: ShowcaseCourse;
  selected: boolean;
  dimmed: boolean;
  controls: string;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const enrolled = course.enrollment !== "none";
  return (
    <a
      id={id}
      href={`/courses/${course.slug}`}
      onClick={onClick}
      aria-expanded={selected}
      aria-controls={selected ? controls : undefined}
      className={cn(
        "group/card relative flex flex-col rounded-xl outline-none transition-[opacity,transform] duration-300 ease-[var(--ease-out-soft)]",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-bg",
        dimmed && "opacity-60 hover:opacity-100",
      )}
    >
      <div data-cover className={cn("relative overflow-hidden rounded-xl bg-surface-3 ring-1 ring-black/5 transition-shadow duration-300", selected ? "shadow-md ring-2 ring-primary" : "group-hover/card:shadow-md")}>
        <CourseCover
          title={course.title}
          category={course.category?.name}
          tone={course.category?.position}
          src={course.coverUrl}
          className="transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover/card:scale-[1.03]"
        />
        {course.enrollment === "completed" ? (
          <span className="absolute top-3 left-3 rounded-full bg-surface/95 px-2 py-0.5 text-caption font-semibold text-success">Concluído</span>
        ) : enrolled ? (
          <span className="absolute top-3 left-3 rounded-full bg-surface/95 px-2 py-0.5 text-caption font-semibold text-primary">Inscrito</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-0.5 pt-3.5">
        <h3 className="line-clamp-2 text-h4 text-fg transition-colors group-hover/card:text-primary">{course.title}</h3>
        <p className="mt-1 truncate text-small text-muted">{course.instructor.name}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-caption text-subtle">
          <span>{formatDuration(course.durationMinutes * 60)}</span>
          <span aria-hidden>·</span>
          <span>{pluralize(course.lessonCount, "aula", "aulas")}</span>
          <span aria-hidden>·</span>
          <span>{COURSE_LEVEL[course.level]}</span>
        </p>
        {enrolled && course.progress != null && (
          <div className="mt-3 flex items-center gap-2.5">
            <Progress value={course.progress} size="sm" tone={course.enrollment === "completed" ? "success" : "primary"} className="flex-1" />
            <span className="text-caption font-medium text-muted tabular-nums">{course.progress}%</span>
          </div>
        )}
      </div>
    </a>
  );
}

function CoursePanel({
  course,
  loggedIn,
  id,
  caret,
  onClose,
}: {
  course: ShowcaseCourse;
  loggedIn: boolean;
  id: string;
  caret: string | null;
  onClose: () => void;
}) {
  const facts = [
    { icon: Clock, label: "Carga horária", value: formatDuration(course.durationMinutes * 60) },
    { icon: PlayCircle, label: "Aulas", value: formatNumber(course.lessonCount) },
    { icon: BarChart3, label: "Nível", value: COURSE_LEVEL[course.level] },
    course.ratingCount > 0
      ? { icon: Star, label: "Avaliação", value: `${formatNumber(course.ratingAvg, 1)} (${course.ratingCount})` }
      : course.enrollmentCount > 0
        ? { icon: Users, label: "Alunos", value: formatNumber(course.enrollmentCount) }
        : null,
  ].filter((f): f is NonNullable<typeof f> => !!f);

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="relative pt-2 pb-1">
      {caret && (
        <span
          className="absolute top-[3px] z-10 size-3.5 -translate-x-1/2 rotate-45 rounded-tl-[3px] border-t border-l border-border bg-surface"
          style={{ left: caret }}
          aria-hidden
        />
      )}
      <div className="relative grid gap-6 rounded-2xl border border-border bg-surface p-4 shadow-md sm:p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 lg:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes do curso"
          className="absolute top-3 right-3 z-10 flex size-10 items-center justify-center rounded-full bg-surface/90 text-muted transition-[color,background-color,transform] hover:rotate-90 hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-5" />
        </button>

        <div data-cover-target className="self-start overflow-hidden rounded-xl ring-1 ring-black/5">
          <CourseCover title={course.title} category={course.category?.name} tone={course.category?.position} src={course.coverUrl} size="lg" />
        </div>

        <div className="flex min-w-0 flex-col">
          <p data-stagger className="flex flex-wrap items-center gap-x-2 pr-12 text-overline text-primary">
            {course.category?.name ?? "Curso"}
            {course.enrollment === "completed" && <span className="text-success">· Concluído</span>}
            {course.enrollment === "active" && <span className="text-muted">· Você está inscrito</span>}
          </p>
          <h3
            id={`${id}-title`}
            data-panel-title
            data-stagger
            tabIndex={-1}
            className="mt-2 pr-10 font-display text-[clamp(1.5rem,2.6vw,2.125rem)] leading-[1.1] tracking-tight text-balance outline-none"
          >
            {course.title}
          </h3>
          <div data-stagger className="mt-3 flex items-center gap-2.5">
            <Avatar name={course.instructor.name} src={course.instructor.avatarUrl} size="sm" />
            <p className="text-small text-muted">
              com <span className="font-medium text-fg">{course.instructor.name}</span>
            </p>
          </div>
          {course.excerpt && (
            <p data-stagger className="mt-4 max-w-prose text-[0.9375rem] leading-relaxed text-muted">
              {course.excerpt}
            </p>
          )}

          <dl data-stagger className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-5 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-caption text-subtle">
                  <f.icon className="size-3.5" aria-hidden />
                  {f.label}
                </dt>
                <dd className="mt-0.5 truncate text-sm font-semibold text-fg tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>

          {course.enrollment === "active" && course.progress != null && (
            <div data-stagger className="mt-5 flex items-center gap-3">
              <Progress value={course.progress} size="sm" className="flex-1" />
              <span className="text-caption font-medium text-muted tabular-nums">{course.progress}% concluído</span>
            </div>
          )}

          <div data-stagger className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start md:mt-auto md:pt-6">
            <EnrollButton
              courseId={course.id}
              slug={course.slug}
              state={course.enrollment}
              continueHref={`/learn/${course.id}`}
              loggedIn={loggedIn}
              paid={course.paid}
              className="sm:min-w-52"
            />
            <Button asChild size="lg" variant="outline" className="group/more">
              <Link href={`/courses/${course.slug}`}>
                Ver detalhes do curso <ArrowRight className="transition-transform duration-200 group-hover/more:translate-x-0.5" />
              </Link>
            </Button>
          </div>
          {course.paid && (
            <p data-stagger className="mt-2 text-caption text-subtle">
              Curso pago: a inscrição online ainda não está disponível. Fale com a secretaria.
            </p>
          )}
        </div>
      </div>
    </section>
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
