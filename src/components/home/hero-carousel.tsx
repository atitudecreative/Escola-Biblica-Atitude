"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Alterna os banners publicados. Os slides ficam empilhados e trocam com fade; a altura
 * acompanha o ativo com transição suave (iguais quando todos são imagens 3:1). O tempo de cada slide é a própria animação
 * da barra de progresso: ao terminar, avança — pausar (hover, foco, botão, aba oculta)
 * congela a barra e o tempo juntos. Sem autoplay para quem prefere menos movimento.
 * Controles ficam abaixo do banner, nunca sobre a arte.
 */
export function HeroCarousel({
  slides,
  labels,
  title,
  interval = 7000,
}: {
  slides: React.ReactNode[];
  labels: string[];
  title: string;
  interval?: number;
}) {
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [height, setHeight] = useState<number>();

  // A altura acompanha o slide ativo (banners de imagem 3:1 e de texto têm alturas diferentes).
  useLayoutEffect(() => {
    const el = slideRefs.current[index];
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const vis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", vis);
    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const go = useCallback((to: number) => setIndex(((to % n) + n) % n), [n]);
  const autoplay = !reduced && !userPaused;
  const running = autoplay && !hovering && !focusWithin && !hidden;

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovering(false)}
      // Pausa com foco de teclado (leitura/navegação); clique do mouse não trava a troca.
      onFocus={(e) => setFocusWithin((e.target as HTMLElement).matches(":focus-visible"))}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocusWithin(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <h1 className="sr-only">{title}</h1>
      <div className="relative overflow-hidden transition-[height] duration-500 ease-[var(--ease-out-soft)] motion-reduce:transition-none" style={{ height }}>
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={i}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${n}: ${labels[i]}`}
              aria-hidden={!active}
              inert={!active}
              className={cn(
                // Sai rápido, entra logo depois: os textos de dois slides nunca se sobrepõem.
                "transition-opacity ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                active ? "relative z-10 opacity-100 delay-200 duration-500" : "pointer-events-none absolute inset-x-0 top-0 opacity-0 duration-200",
              )}
            >
              {slide}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Escolher destaque">
          {slides.map((_, i) => {
            const active = i === index;
            return (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Destaque ${i + 1}: ${labels[i]}`}
                aria-current={active ? "true" : undefined}
                className="group flex h-10 items-center px-1 outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring"
              >
                <span
                  className={cn(
                    "relative block h-1.5 overflow-hidden rounded-full bg-border-strong transition-[width,background-color] duration-300 ease-[var(--ease-out-soft)]",
                    active ? "w-10" : "w-3 group-hover:bg-subtle",
                  )}
                >
                  {active && (
                    <span
                      key={`${index}-${autoplay}`}
                      className="hero-progress absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{
                        animationDuration: `${interval}ms`,
                        animationPlayState: running ? "running" : "paused",
                        width: autoplay ? undefined : "100%",
                        animationName: autoplay ? undefined : "none",
                      }}
                      onAnimationEnd={() => go(index + 1)}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-0.5 text-muted">
          {!reduced && (
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? "Retomar troca automática" : "Pausar troca automática"}
              className="flex size-10 items-center justify-center rounded-full outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
            >
              {userPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Destaque anterior"
            className="flex size-10 items-center justify-center rounded-full outline-none transition-[color,background-color,transform] hover:-translate-x-0.5 hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Próximo destaque"
            className="flex size-10 items-center justify-center rounded-full outline-none transition-[color,background-color,transform] hover:translate-x-0.5 hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
