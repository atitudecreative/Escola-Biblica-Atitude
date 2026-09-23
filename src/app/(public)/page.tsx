import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { db } from "@/server/db";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import {
  catalogFacets, enrollmentMap, featuredTeachers, homeCollections, platformNumbers, withProgress, type CatalogCourse,
} from "@/server/services/catalog";
import { continueLearning } from "@/server/services/learning";
import { HeroSlider } from "@/components/public/hero-slider";
import { HeroStack } from "@/components/public/hero-stack";
import { CourseCard } from "@/components/course/course-card";
import { CourseCover } from "@/components/course/course-cover";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/icon";
import { formatCompact, pluralize } from "@/lib/format";

export default async function HomePage() {
  const [home, user, now] = await Promise.all([getSettings("home"), getSessionUser(), Promise.resolve(new Date())]);
  const [banners, collections, facets, teachers, numbers, continuing] = await Promise.all([
    db.banner.findMany({
      where: {
        placement: "HOME_HERO",
        isActive: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { position: "asc" },
    }),
    homeCollections(home.featuredCourseIds),
    catalogFacets(),
    featuredTeachers(3),
    platformNumbers(),
    user ? continueLearning(user.id, 3) : Promise.resolve([]),
  ]);

  const allIds = [...collections.featured, ...collections.popular, ...collections.newest].map((c) => c.id);
  const progress = await enrollmentMap(user?.id, allIds);
  const s = home.sections;

  const slides = banners.length
    ? banners
    : [{ id: "default", eyebrow: null, title: "Formação bíblica para uma fé que transforma", subtitle: "Cursos de Bíblia, teologia e liderança com certificado.", ctaLabel: "Explorar cursos", ctaHref: "/courses", imageUrl: null }];

  return (
    <>
      <HeroSlider slides={slides} aside={<HeroStack courses={collections.featured.length ? collections.featured : collections.popular} />} />

      {/* Prova social */}
      <section aria-label="A Escola em números" className="border-b border-border bg-surface">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-border px-4 sm:px-6 md:grid-cols-4 md:divide-x lg:px-8">
          {[
            { k: "Alunos", v: formatCompact(numbers.students) },
            { k: "Cursos abertos", v: numbers.courses },
            { k: "Certificados emitidos", v: formatCompact(numbers.certificates) },
            { k: "Horas de estudo", v: formatCompact(numbers.hours) },
          ].map((it) => (
            <div key={it.k} className="py-6 md:px-8 md:first:pl-0">
              <dt className="text-small text-muted">{it.k}</dt>
              <dd className="mt-1 text-[1.75rem] font-semibold tracking-tight tabular-nums">{it.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        {s.continue && continuing.length > 0 && (
          <Section title="Continue aprendendo" description="Retome de onde parou." href="/my-courses" hrefLabel="Meus cursos">
            <div className="grid gap-4 md:grid-cols-3">
              {continuing.map((e) => (
                <Link key={e.id} href={`/courses/${e.course.slug}`} className="group flex gap-4 rounded-xl border border-border bg-surface p-3 shadow-xs transition hover:border-border-strong hover:shadow-md">
                  <CourseCover title={e.course.title} tone={e.course.category?.position} src={e.course.coverUrl} size="sm" className="w-28 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 py-1">
                    <p className="line-clamp-2 text-h4 group-hover:text-primary">{e.course.title}</p>
                    <p className="mt-1 truncate text-caption text-subtle">{e.lastLesson?.title ?? "Comece pela primeira aula"}</p>
                    <Progress value={e.progressPercent} size="sm" className="mt-3" />
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {s.featured && collections.featured.length > 0 && (
          <Section title="Cursos em destaque" description="Selecionados pela coordenação para este semestre." href="/courses" hrefLabel="Ver catálogo">
            <CourseGrid courses={withProgress(collections.featured, progress)} />
          </Section>
        )}

        {s.categories && (
          <section id="categorias" className="scroll-mt-24">
            <SectionTitle title="Explore por área" description="Trilhas de formação para cada fase da sua caminhada." />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {facets.categories.filter((c) => c._count.courses > 0).map((c) => (
                <Link
                  key={c.id}
                  href={`/courses?category=${c.slug}`}
                  className="group flex flex-col rounded-xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:bg-primary-soft/40 sm:p-5"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-primary-fg">
                    <Icon name={c.icon} className="size-5" />
                  </span>
                  <span className="mt-4 text-h4">{c.name}</span>
                  <span className="mt-0.5 text-caption text-subtle">{pluralize(c._count.courses, "curso", "cursos")}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {s.popular && (
          <Section title="Mais procurados" description="O que a comunidade está estudando agora." href="/courses?sort=popular" hrefLabel="Ver todos">
            <CourseGrid courses={withProgress(collections.popular, progress)} />
          </Section>
        )}

        {s.newest && (
          <Section title="Novos cursos" description="Acabaram de chegar ao catálogo." href="/courses?sort=newest" hrefLabel="Ver todos">
            <CourseGrid courses={withProgress(collections.newest, progress)} />
          </Section>
        )}

        {s.teachers && teachers.length > 0 && (
          <section id="professores" className="scroll-mt-24">
            <SectionTitle title="Aprenda com quem ensina há anos" description="Professores da equipe de ensino da igreja." />
            <div className="grid gap-4 md:grid-cols-3">
              {teachers.map((t) => (
                <Link key={t.id} href={`/teachers/${t.id}`} className="group rounded-xl border border-border bg-surface p-5 transition hover:border-border-strong hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} src={t.avatarUrl} size="lg" />
                    <div className="min-w-0">
                      <p className="text-h4 group-hover:text-primary">{t.name}</p>
                      <p className="line-clamp-1 text-small text-muted">{t.headline}</p>
                    </div>
                  </div>
                  {t.bio && <p className="mt-4 line-clamp-3 text-small text-muted">{t.bio}</p>}
                  <p className="mt-4 text-caption text-subtle">
                    {pluralize(t.courses, "curso", "cursos")} · {pluralize(t.students, "aluno", "alunos")}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {s.testimonials && home.testimonials.length > 0 && (
          <section>
            <SectionTitle title="Quem estuda, recomenda" />
            <div className="grid gap-4 md:grid-cols-3">
              {home.testimonials.map((t, i) => (
                <figure key={i} className="flex flex-col rounded-xl border border-border bg-surface p-6">
                  <Quote className="size-5 text-accent" aria-hidden />
                  <blockquote className="mt-4 flex-1 font-display text-[1.0625rem] leading-relaxed text-fg">“{t.quote}”</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <Avatar name={t.name} size="sm" />
                    <div>
                      <p className="text-small font-medium">{t.name}</p>
                      <p className="text-caption text-subtle">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {s.benefits && home.benefits.length > 0 && (
          <section className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-overline text-primary">Por que estudar aqui</p>
              <h2 className="mt-3 font-display text-[2.25rem] leading-tight tracking-tight text-balance">Uma escola pensada para a sua rotina — e para a sua fé.</h2>
            </div>
            <dl className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
              {home.benefits.map((b, i) => (
                <div key={i}>
                  <dt className="flex items-center gap-3 text-h4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-fg">
                      <Icon name={b.icon} className="size-4.5" />
                    </span>
                    {b.title}
                  </dt>
                  <dd className="mt-2 text-sm text-muted">{b.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      {s.cta && (
        <section className="relative overflow-hidden bg-primary text-primary-fg">
          <svg className="absolute -right-24 -bottom-40 size-[560px] opacity-15" viewBox="0 0 400 400" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <circle key={i} cx="200" cy="200" r={30 + i * 22} fill="none" stroke="currentColor" />
            ))}
          </svg>
          <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div className="max-w-xl">
              <h2 className="font-display text-[2rem] leading-tight tracking-tight text-balance">{home.ctaTitle}</h2>
              <p className="mt-3 opacity-85">{home.ctaText}</p>
            </div>
            <Button asChild size="lg" variant="secondary" className="bg-white text-[#1b1a17] hover:bg-white/90">
              <Link href={user ? "/courses" : "/register"}>
                {user ? "Explorar cursos" : "Criar minha conta"} <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      )}
    </>
  );
}

function SectionTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-h2">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Section({ title, description, href, hrefLabel, children }: { title: string; description?: string; href: string; hrefLabel: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionTitle
        title={title}
        description={description}
        action={
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
            {hrefLabel} <ArrowRight className="size-4" />
          </Link>
        }
      />
      {children}
    </section>
  );
}

function CourseGrid({ courses }: { courses: (CatalogCourse & { progress: number | null; completed: boolean })[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [scrollbar-width:none]">
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} className="w-[78vw] max-w-xs shrink-0 snap-start sm:w-auto sm:max-w-none" />
      ))}
    </div>
  );
}
