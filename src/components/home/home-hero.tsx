import Link from "next/link";
import { ArrowRight, ArrowUpRight, Award, BookOpenText, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { HeroCourse } from "@/server/services/catalog";
import { COURSE_LEVEL } from "@/lib/labels";
import { formatDuration, pluralize } from "@/lib/format";

export type HeroBanner = {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
};

/**
 * Banner principal (único). Conteúdo vem de Admin › Banners (primeiro banner ativo).
 * Com imagem: só a arte, clicável (o texto dela já é a mensagem). Sem imagem: texto + "sumário"
 * real do curso divulgado, com módulos numerados como o índice de um livro.
 * Proporção ~3:1 no desktop (1200×400), empilhado no celular.
 */
export function HomeHero({ banner, course }: { banner: HeroBanner; course: HeroCourse | null }) {
  const image = banner.imageUrl;
  const external = banner.ctaHref?.startsWith("http");
  const cta = banner.ctaLabel && banner.ctaHref ? { label: banner.ctaLabel, href: banner.ctaHref } : { label: "Explorar cursos", href: "/courses" };

  // Banner com imagem: a arte já traz o texto — nada é sobreposto. O banner inteiro vira o link
  // do CTA e o título fica disponível para leitores de tela.
  if (image) {
    const label = banner.title;
    const img = (
      // eslint-disable-next-line @next/next/no-img-element -- banner do CMS
      <img
        src={image}
        alt=""
        fetchPriority="high"
        className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover/banner:scale-[1.015]"
      />
    );
    const frame = "group/banner block aspect-[3/1] overflow-hidden rounded-[1.25rem] bg-surface-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-bg";
    return (
      <section aria-labelledby="hero-title">
        <h1 id="hero-title" className="sr-only">
          {banner.title}
        </h1>
        {banner.ctaHref ? (
          external ? (
            <a href={banner.ctaHref} target="_blank" rel="noopener noreferrer" aria-label={label} className={frame}>
              {img}
            </a>
          ) : (
            <Link href={banner.ctaHref} aria-label={label} className={frame}>
              {img}
            </Link>
          )
        ) : (
          <div className={frame}>{img}</div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden rounded-[1.25rem] bg-hero text-white lg:min-h-[400px]"
    >
      <HeroPattern />

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-10 lg:p-12">
        <div className="max-w-xl">
          {banner.eyebrow && (
            <p className="hero-rise inline-flex items-center gap-2.5 text-overline opacity-85">
              <span className="h-px w-7 bg-current opacity-70" aria-hidden />
              {banner.eyebrow}
            </p>
          )}
          <h1 id="hero-title" className="hero-rise mt-4 font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.04] tracking-tight text-balance [animation-delay:60ms]">
            {banner.title}
          </h1>
          {banner.subtitle && (
            <p className="hero-rise mt-4 max-w-lg text-[1.0625rem] leading-relaxed opacity-85 [animation-delay:120ms]">{banner.subtitle}</p>
          )}
          <div className="hero-rise mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 [animation-delay:180ms]">
            <Button asChild size="lg" className="group/cta bg-white text-[#15241f] shadow-sm hover:bg-white/92">
              {external ? (
                <a href={cta.href} target="_blank" rel="noopener noreferrer">
                  {cta.label} <ArrowUpRight className="transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
                </a>
              ) : (
                <Link href={cta.href}>
                  {cta.label} <ArrowRight className="transition-transform duration-200 group-hover/cta:translate-x-1" />
                </Link>
              )}
            </Button>
            {cta.href !== "/courses" && (
              <Link href="/courses" className="inline-flex h-11 items-center gap-1.5 rounded-md text-sm font-medium underline-offset-4 opacity-90 hover:underline hover:opacity-100">
                Ver todos os cursos
              </Link>
            )}
          </div>
        </div>

        {/* Composição lateral só quando cabe ao lado do texto; empilhada, alongaria demais o banner. */}
        <div className="hidden lg:block">{course ? <Syllabus course={course} /> : <PlatformPillars />}</div>
      </div>
    </section>
  );
}

/** Cartão-índice do curso em destaque: parece a página de sumário de um livro. */
function Syllabus({ course }: { course: HeroCourse }) {
  const modules = course.modules.slice(0, 4);
  const more = course.modules.length - modules.length;
  return (
    <div className="hero-rise relative mx-auto w-full max-w-md [animation-delay:140ms] lg:mr-0">
      {/* folha de trás: profundidade sem sombra pesada */}
      <div className="absolute inset-x-5 -bottom-2.5 top-3 rounded-2xl bg-white/12" aria-hidden />
      <Link
        href={`/courses/${course.slug}`}
        className="group/syl relative block rounded-2xl bg-surface p-5 text-fg shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] outline-none ring-offset-2 ring-offset-hero transition-transform duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-white sm:p-6"
      >
        <span className="absolute inset-y-5 left-0 w-1 rounded-r-full bg-accent" aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <p className="text-overline text-primary">Sumário</p>
          {course.category && <p className="truncate text-caption text-subtle">{course.category.name}</p>}
        </div>
        <p className="mt-2 font-display text-[1.5rem] leading-tight tracking-tight text-balance">{course.title}</p>

        {modules.length > 0 && (
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {modules.map((m, i) => (
              <li
                key={m.id}
                className="hero-rise flex items-baseline gap-3 py-2.5 text-sm"
                style={{ animationDelay: `${260 + i * 70}ms` }}
              >
                <span className="w-6 shrink-0 font-display text-[0.9375rem] text-accent tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                <span className="shrink-0 text-caption text-subtle tabular-nums">{pluralize(m.lessons, "aula", "aulas")}</span>
              </li>
            ))}
            {more > 0 && <li className="py-2 pl-9 text-caption text-subtle">+ {pluralize(more, "módulo", "módulos")}</li>}
          </ol>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Avatar name={course.instructor.name} src={course.instructor.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium">{course.instructor.name}</p>
            <p className="truncate text-caption text-subtle">
              {formatDuration(course.durationMinutes * 60)} · {pluralize(course.lessonCount, "aula", "aulas")} · {COURSE_LEVEL[course.level]}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform duration-300 group-hover/syl:translate-x-0.5" aria-hidden>
            <ArrowRight className="size-4" />
          </span>
        </div>
      </Link>
    </div>
  );
}

/** Sem cursos publicados ainda: mostra o que a plataforma oferece (funcionalidades reais). */
function PlatformPillars() {
  const items = [
    { icon: BookOpenText, title: "Aulas em vídeo e texto", text: "Módulos organizados, no seu ritmo." },
    { icon: ClipboardCheck, title: "Avaliações e atividades", text: "Correção e retorno dos professores." },
    { icon: Award, title: "Certificado verificável", text: "Com código e QR Code de validação." },
  ];
  return (
    <ul className="hero-rise mx-auto grid w-full max-w-md gap-2.5 [animation-delay:140ms] lg:mr-0">
      {items.map((it) => (
        <li key={it.title} className="flex items-center gap-4 rounded-xl bg-white/10 p-4 ring-1 ring-white/10">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/12">
            <it.icon className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">{it.title}</span>
            <span className="block text-small opacity-80">{it.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Grafismo da marca: arcos concêntricos finos saindo do canto, sem gradientes. */
function HeroPattern() {
  return (
    <svg className="pointer-events-none absolute -z-10 -right-24 -bottom-40 size-[640px] text-white opacity-[0.09]" viewBox="0 0 400 400" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <circle key={i} cx="260" cy="260" r={40 + i * 26} fill="none" stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}
