"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Slide = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
};

/** Slider do hero (conteúdo gerenciado em Admin › Banners). Acessível: pausa, teclado, reduced-motion. */
export function HeroSlider({ slides, aside }: { slides: Slide[]; aside?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 7000);
    return () => clearInterval(t);
  }, [n, paused]);

  if (!n) return null;
  const s = slides[i];
  const external = s.ctaHref?.startsWith("http");

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="relative overflow-hidden border-b border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        if (e.key === "ArrowLeft") go(i - 1);
      }}
    >
      {s.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- banner do CMS */}
          <img key={s.id} src={s.imageUrl} alt="" className="absolute inset-0 size-full object-cover animate-fade-in" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
        </>
      ) : (
        <HeroBackdrop />
      )}
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-28">
        <div key={s.id} className={cn("max-w-2xl animate-slide-up", s.imageUrl && "text-white")} aria-live="polite">
          {s.eyebrow && (
            <p className={cn("mb-5 inline-flex items-center gap-2 text-overline", s.imageUrl ? "text-white/80" : "text-primary")}>
              <span className="h-px w-6 bg-current" aria-hidden />
              {s.eyebrow}
            </p>
          )}
          <h1 className="text-display text-balance">{s.title}</h1>
          {s.subtitle && <p className={cn("mt-5 max-w-xl text-[1.0625rem] leading-relaxed", s.imageUrl ? "text-white/85" : "text-muted")}>{s.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {s.ctaLabel && s.ctaHref && (
              <Button asChild size="lg">
                {external ? (
                  <a href={s.ctaHref} target="_blank" rel="noopener noreferrer">
                    {s.ctaLabel} <ArrowRight />
                  </a>
                ) : (
                  <Link href={s.ctaHref}>
                    {s.ctaLabel} <ArrowRight />
                  </Link>
                )}
              </Button>
            )}
            <Button asChild size="lg" variant={s.imageUrl ? "secondary" : "outline"}>
              <Link href="/register">Criar conta gratuita</Link>
            </Button>
          </div>
        </div>
        {aside && !s.imageUrl && <div className="hidden lg:block">{aside}</div>}
      </div>

      {n > 1 && (
        <div className="relative mx-auto flex max-w-7xl items-center gap-3 px-4 pb-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Escolher destaque">
            {slides.map((sl, k) => (
              <button
                key={sl.id}
                role="tab"
                aria-selected={k === i}
                aria-label={`Destaque ${k + 1}: ${sl.title}`}
                onClick={() => go(k)}
                className={cn("h-1.5 rounded-full transition-all", k === i ? "w-8 bg-primary" : "w-3 bg-border-strong hover:bg-subtle", s.imageUrl && (k === i ? "bg-white" : "bg-white/40"))}
              />
            ))}
          </div>
          <div className={cn("ml-auto flex items-center gap-1", s.imageUrl && "text-white")}>
            <button onClick={() => setPaused((p) => !p)} className="rounded-md p-2 opacity-70 hover:opacity-100" aria-label={paused ? "Retomar rotação" : "Pausar rotação"}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </button>
            <button onClick={() => go(i - 1)} className="rounded-md p-2 opacity-70 hover:opacity-100" aria-label="Anterior">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => go(i + 1)} className="rounded-md p-2 opacity-70 hover:opacity-100" aria-label="Próximo">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <svg className="absolute -top-40 -right-40 size-[900px] text-primary opacity-[0.07] dark:opacity-[0.12]" viewBox="0 0 400 400">
        {Array.from({ length: 10 }).map((_, i) => (
          <circle key={i} cx="200" cy="200" r={20 + i * 19} fill="none" stroke="currentColor" strokeWidth="1" />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />
    </div>
  );
}
