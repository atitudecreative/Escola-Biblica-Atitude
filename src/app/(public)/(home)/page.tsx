import Link from "next/link";
import { ArrowRight, BookPlus, Sparkles } from "lucide-react";
import { db } from "@/server/db";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { catalogFacets, featuredTeachers, homeShowcase } from "@/server/services/catalog";
import { continueLearning } from "@/server/services/learning";
import { HomeHero, type HeroBanner } from "@/components/home/home-hero";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { CourseShowcase } from "@/components/home/course-showcase";
import { CategoryExplorer } from "@/components/home/category-explorer";
import { ContinueLearning, HomeSection, HowItWorks, TeachersStrip, Testimonials } from "@/components/home/home-sections";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Home: vitrine da Escola, não painel. Funil: entender (hero) → retomar (se já estuda)
 * → descobrir (destaques e áreas) → conhecer o curso (card expandido) → inscrever-se.
 * Seções respeitam os interruptores de Admin › Banners e home. Vários banners ativos se alternam.
 */
export default async function HomePage() {
  const now = new Date();
  const [home, general, courseSettings, user, banners] = await Promise.all([
    getSettings("home"),
    getSettings("general"),
    getSettings("courses"),
    getSessionUser(),
    db.banner.findMany({
      where: {
        placement: "HOME_HERO",
        isActive: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { position: "asc" },
    }),
  ]);
  const s = home.sections;
  const [showcase, facets, teachers, continuing] = await Promise.all([
    homeShowcase(user?.id, home.featuredCourseIds, banners.map((b) => b.ctaHref)),
    catalogFacets(),
    s.teachers ? featuredTeachers(3) : Promise.resolve([]),
    user && s.continue ? continueLearning(user.id, 3) : Promise.resolve([]),
  ]);

  const slides: HeroBanner[] = banners.length
    ? banners
    : [
        {
          eyebrow: general.platformName,
          title: general.tagline,
          subtitle: "Cursos de Bíblia, teologia e liderança, com professores da igreja e certificado ao final.",
          ctaLabel: "Explorar cursos",
          ctaHref: "/courses",
          imageUrl: null,
        },
      ];
  const loggedIn = !!user;
  const areas = facets.categories.filter((c) => c._count.courses > 0).map((c) => ({ slug: c.slug, name: c.name, icon: c.icon, count: c._count.courses }));
  const total = areas.reduce((n, a) => n + a.count, 0) || showcase.catalog.length;
  const noCourses = showcase.catalog.length === 0;
  const isNewcomer = !user || continuing.length === 0;
  const canCreate = !!user && (user.permissions.has("courses.create") || user.permissions.has("courses.manage_any"));
  const firstName = user?.name.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-8">
      {firstName && (
        <p className="mb-4 text-sm text-muted">
          Olá, <span className="font-medium text-fg">{firstName}</span>. {continuing.length > 0 ? "Que bom te ver de volta." : "Que tal começar um curso hoje?"}
        </p>
      )}

      {slides.length > 1 ? (
        <HeroCarousel
          title={general.platformName}
          labels={slides.map((b) => b.title)}
          slides={slides.map((b, i) => (
            <HomeHero key={i} banner={b} course={showcase.heroes[i] ?? null} heading="h2" headingId={`hero-title-${i}`} />
          ))}
        />
      ) : (
        <HomeHero banner={slides[0]} course={showcase.heroes[0] ?? null} />
      )}

      <div className="mt-14 space-y-16 lg:mt-16 lg:space-y-20">
        {continuing.length > 0 && (
          <HomeSection id="continuar" eyebrow="Seu aprendizado" title="Continue de onde parou" action={{ href: "/my-courses", label: "Meus cursos" }}>
            <ContinueLearning items={continuing} />
          </HomeSection>
        )}

        {noCourses ? (
          <EmptyState
            icon={canCreate ? BookPlus : Sparkles}
            title="Os primeiros cursos estão sendo preparados"
            description={
              canCreate
                ? "Crie um curso, adicione módulos e aulas e publique. Ele aparece aqui automaticamente."
                : "Em breve você encontrará aqui os cursos da Escola. Crie sua conta para ser avisado quando abrirem."
            }
            action={
              canCreate ? (
                <Button asChild>
                  <Link href="/teacher/courses/new">Criar o primeiro curso</Link>
                </Button>
              ) : !user ? (
                <Button asChild>
                  <Link href="/register">Criar conta gratuita</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {s.featured && showcase.featured.length > 0 && (
              <HomeSection
                id="destaques"
                eyebrow={isNewcomer ? "Comece por aqui" : "Em destaque"}
                title={isNewcomer ? "Cursos escolhidos para começar bem" : "Selecionados pela coordenação"}
                description="Toque em um curso para ver os detalhes e se inscrever."
                action={{ href: "/courses", label: "Ver catálogo" }}
              >
                <CourseShowcase courses={showcase.featured} loggedIn={loggedIn} idPrefix="featured" />
              </HomeSection>
            )}

            {s.categories && (
              <HomeSection id="areas" eyebrow="Explore" title="Encontre seu próximo curso por área" description="Filtre por área de estudo; os mais procurados aparecem primeiro.">
                <CategoryExplorer areas={areas} courses={showcase.catalog} total={total} loggedIn={loggedIn} />
              </HomeSection>
            )}
          </>
        )}

        {isNewcomer && (
          <HomeSection id="como-funciona" eyebrow="Como funciona" title="Do primeiro clique ao certificado">
            <HowItWorks benefits={s.benefits ? home.benefits : []} autoCertificate={courseSettings.autoIssueCertificates} />
          </HomeSection>
        )}

        {s.teachers && teachers.length > 0 && (
          <HomeSection id="professores" eyebrow="Quem ensina" title="Professores da Escola">
            <TeachersStrip teachers={teachers} />
          </HomeSection>
        )}

        {s.testimonials && home.testimonials.length > 0 && (
          <HomeSection id="depoimentos" eyebrow="Depoimentos" title="Quem estuda, recomenda">
            <Testimonials items={home.testimonials} />
          </HomeSection>
        )}

        {s.cta && !user && (
          <section aria-labelledby="cta-title" className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 id="cta-title" className="font-display text-[1.75rem] leading-tight tracking-tight text-balance">
                {home.ctaTitle}
              </h2>
              <p className="mt-2 text-muted">{home.ctaText}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="group">
                <Link href="/register">
                  Criar minha conta <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/login">Já tenho conta</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
