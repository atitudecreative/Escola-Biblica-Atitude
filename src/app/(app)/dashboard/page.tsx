import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList, Compass, Flame, Gauge, ListChecks, Lock, Play, Settings2, ShieldCheck } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { studentHome } from "@/server/services/student-home";
import { CourseCover } from "@/components/course/course-cover";
import { CourseCard } from "@/components/course/course-card";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { formatDate, formatDuration, formatNumber, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const user = await requireUserPage();
  const data = await studentHome(user.id);
  const { stats, primary } = data;

  const panels = [
    user.roles.includes("teacher") && { href: "/teacher", label: "Painel do professor", icon: Gauge },
    user.permissions.has("analytics.view") && { href: "/manager", label: "Indicadores", icon: BarChart3 },
    user.permissions.has("settings.manage") && { href: "/admin", label: "Administração", icon: ShieldCheck },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Gauge }[];

  const activity = buildActivity(stats.activity);
  const earned = data.achievements.filter((a) => a.awardedAt);
  const nextBadges = data.achievements.filter((a) => !a.awardedAt).slice(0, 3);

  return (
    <div className="space-y-10">
      {sp.denied && <Alert tone="warning">Você não tem acesso àquela área. Se precisar, fale com a coordenação.</Alert>}
      {sp.welcome && <Alert tone="success" title="Conta criada!">Que bom ter você aqui. Explore o catálogo e comece seu primeiro curso.</Alert>}

      {/* Saudação */}
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-small text-muted">{greeting()},</p>
          <h1 className="mt-1 font-display text-[2.25rem] leading-tight tracking-tight">{data.firstName}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {primary
              ? `Você já concluiu ${primary.progressPercent}% de ${primary.course.title}. Que tal avançar mais um pouco hoje?`
              : "Escolha um curso no catálogo e comece sua jornada de formação."}
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn("flex size-9 items-center justify-center rounded-full", data.streak ? "bg-accent-soft text-accent-soft-fg" : "bg-surface-2 text-subtle")}>
              <Flame className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold tabular-nums">{pluralize(data.streak, "dia", "dias")}</p>
              <p className="text-caption text-subtle">sequência de estudo</p>
            </div>
          </div>
          <span className="h-8 w-px bg-border" aria-hidden />
          <div className="min-w-28">
            <p className="text-sm font-semibold">Nível {data.level.level}</p>
            <Progress value={data.level.progress} size="sm" tone="accent" className="mt-1.5" label="Progresso do nível" />
            <p className="mt-1 text-caption text-subtle tabular-nums">{formatNumber(data.xp)} XP</p>
          </div>
        </div>
      </header>

      {panels.length > 0 && (
        <nav aria-label="Seus painéis" className="flex flex-wrap gap-2">
          {panels.map((p) => (
            <Button key={p.href} asChild variant="outline" size="sm">
              <Link href={p.href}><p.icon /> {p.label}</Link>
            </Button>
          ))}
        </nav>
      )}

      {data.banner && (
        <section className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-primary-soft/60 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            {data.banner.eyebrow && <p className="text-overline text-primary">{data.banner.eyebrow}</p>}
            <p className="mt-1 text-h3">{data.banner.title}</p>
            {data.banner.subtitle && <p className="mt-0.5 text-sm text-muted">{data.banner.subtitle}</p>}
          </div>
          {data.banner.ctaHref && data.banner.ctaLabel && (
            <Button asChild variant="outline" className="shrink-0">
              <Link href={data.banner.ctaHref}>{data.banner.ctaLabel}</Link>
            </Button>
          )}
        </section>
      )}

      {/* Continue estudando */}
      {primary ? (
        <section aria-labelledby="continuar">
          <h2 id="continuar" className="sr-only">Continue estudando</h2>
          <div className="grid overflow-hidden rounded-2xl border border-border bg-surface shadow-sm md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Link href={`/courses/${primary.course.slug}`} className="relative block">
              <CourseCover title={primary.course.title} category={primary.course.category?.name} tone={primary.course.category?.position} size="lg" className="h-full min-h-48" />
            </Link>
            <div className="flex flex-col p-5 sm:p-7">
              <p className="text-overline text-primary">Continue de onde parou</p>
              <p className="mt-3 text-caption text-subtle">{primary.lastLesson?.module.title ?? "Primeira aula"}</p>
              <h3 className="mt-0.5 text-h2">{primary.lastLesson?.title ?? primary.course.title}</h3>
              <p className="mt-1 text-sm text-muted">{primary.course.title} · {primary.course.instructor.name}</p>
              <div className="mt-6">
                <div className="mb-1.5 flex justify-between text-small">
                  <span className="text-muted">Progresso do curso</span>
                  <span className="font-semibold tabular-nums">{primary.progressPercent}%</span>
                </div>
                <Progress value={primary.progressPercent} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2 md:mt-auto md:pt-6">
                <Button asChild size="lg">
                  <Link href={primary.nextLessonId ? `/learn/${primary.courseId}/${primary.nextLessonId}` : `/learn/${primary.courseId}`}>
                    <Play className="fill-current" /> Continuar aula
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link href={`/courses/${primary.course.slug}`}>Ver curso</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Compass}
          title="Você ainda não começou nenhum curso"
          description="Nossos cursos são gratuitos e você estuda no seu ritmo, com certificado ao final."
          action={<Button asChild><Link href="/courses">Explorar catálogo</Link></Button>}
        />
      )}

      {/* Indicadores + atividade */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface sm:grid-cols-4">
          {[
            { label: "Em andamento", value: stats.active, href: "/my-courses" },
            { label: "Concluídos", value: stats.completed, href: "/my-courses?tab=completed" },
            { label: "Horas estudadas", value: formatNumber(stats.hours, stats.hours < 10 ? 1 : 0), href: null },
            { label: "Certificados", value: stats.certificates, href: "/certificates" },
          ].map((k, i) => {
            const inner = (
              <>
                <p className="text-small text-muted">{k.label}</p>
                <p className="mt-1.5 text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums">{k.value}</p>
              </>
            );
            const cls = cn("p-4 sm:p-5 border-border", i % 2 === 0 && "border-r", i < 2 && "border-b sm:border-b-0", i < 3 && "sm:border-r");
            return k.href ? (
              <Link key={k.label} href={k.href} className={cn(cls, "transition-colors hover:bg-surface-2")}>{inner}</Link>
            ) : (
              <div key={k.label} className={cls}>{inner}</div>
            );
          })}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-small font-medium">Últimas 4 semanas</p>
            <p className="text-caption text-subtle">média {stats.avgProgress}% de progresso</p>
          </div>
          <div className="mt-3 grid grid-cols-[repeat(28,minmax(0,1fr))] items-end gap-[3px]" role="img" aria-label={`Minutos estudados por dia nas últimas 4 semanas. Total: ${formatDuration(activity.total)}`}>
            {activity.days.map((d) => (
              <div
                key={d.key}
                title={`${formatDate(d.date, "dd/MM")}: ${d.minutes ? `${d.minutes} min` : "sem estudo"}`}
                className="rounded-[3px] bg-primary"
                style={{ height: `${Math.max(4, (d.minutes / activity.max) * 56)}px`, opacity: d.minutes ? 0.35 + 0.65 * (d.minutes / activity.max) : 0.1 }}
              />
            ))}
          </div>
          <p className="mt-2 text-caption text-subtle">{formatDuration(activity.total)} de estudo no período</p>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          {/* Meus cursos */}
          <section>
            <SectionHeader
              title="Meus cursos"
              action={<Link href="/my-courses" className="inline-flex items-center gap-1 text-small font-medium text-primary hover:underline">Ver todos <ArrowRight className="size-4" /></Link>}
            />
            {data.enrollments.length === 0 ? (
              <EmptyState compact icon={Compass} title="Nenhum curso por aqui" description="Quando você se matricular, seus cursos aparecem aqui." />
            ) : (
              <>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface sm:hidden">
                {data.enrollments.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    <Link href={e.status === "COMPLETED" ? `/courses/${e.course.slug}` : `/learn/${e.courseId}`} className="flex items-center gap-3 p-3">
                      <CourseCover title={e.course.title} tone={e.course.category?.position} src={e.course.coverUrl} size="sm" className="w-24 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium">{e.course.title}</span>
                        <Progress value={e.progressPercent} size="sm" tone={e.status === "COMPLETED" ? "success" : "primary"} className="mt-2" />
                        <span className="mt-1 block text-caption text-subtle">{e.status === "COMPLETED" ? "Concluído" : `${e.progressPercent}% concluído`}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
                {data.enrollments.slice(0, 6).map((e) => (
                  <CourseCard
                    key={e.id}
                    course={{ ...e.course, progress: e.progressPercent, completed: e.status === "COMPLETED" }}
                    href={e.status === "COMPLETED" ? `/courses/${e.course.slug}` : `/learn/${e.courseId}`}
                  />
                ))}
              </div>
              </>
            )}
          </section>

          {data.recommended.length > 0 && (
            <section>
              <SectionHeader title="Recomendados para você" description="Com base nas áreas que você estuda." />
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 xl:grid-cols-3">
                {data.recommended.map((c) => (
                  <CourseCard key={c.id} course={c} className="w-[72vw] max-w-72 shrink-0 snap-start sm:w-auto sm:max-w-none" />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-8">
          <section>
            <SectionHeader title="Próximas atividades" />
            {data.upcoming.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-small text-muted">Nenhuma atividade pendente. Tudo em dia!</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {data.upcoming.map((u) => (
                  <li key={u.kind + u.id}>
                    <Link href={u.href} className="flex gap-3 px-4 py-3 transition hover:bg-surface-2">
                      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", u.kind === "quiz" ? "bg-info-soft text-info" : "bg-accent-soft text-accent-soft-fg")}>
                        {u.kind === "quiz" ? <ListChecks className="size-4" /> : <ClipboardList className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium">{u.title}</span>
                        <span className="line-clamp-1 text-caption text-subtle">{u.course}</span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {u.returned && <Badge tone="warning">Devolvida</Badge>}
                          {u.dueAt && <Badge tone={u.dueAt < new Date() ? "danger" : "neutral"}>Prazo {formatDate(u.dueAt, "dd/MM")}</Badge>}
                          {u.kind === "quiz" && <Badge tone="info">Avaliação</Badge>}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="conquistas">
            <SectionHeader title="Conquistas" description={`${earned.length} de ${data.achievements.length} desbloqueadas`} />
            <ul className="grid grid-cols-4 gap-2">
              {earned.slice(0, 8).map((a) => (
                <li key={a.id} title={`${a.name} — ${a.description}`} className="flex aspect-square flex-col items-center justify-center rounded-xl border border-border bg-surface p-2 text-center">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg"><Icon name={a.icon} className="size-4.5" /></span>
                  <span className="mt-1.5 line-clamp-2 text-[0.6875rem] leading-tight font-medium">{a.name}</span>
                </li>
              ))}
              {nextBadges.map((a) => (
                <li key={a.id} title={`Bloqueada: ${a.description}`} className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-border-strong p-2 text-center text-subtle">
                  <Lock className="size-4" />
                  <span className="mt-1.5 line-clamp-2 text-[0.6875rem] leading-tight">{a.name}</span>
                </li>
              ))}
            </ul>
            <Link href="/profile#conquistas" className="mt-3 inline-flex items-center gap-1 text-small font-medium text-primary hover:underline">
              Ver todas <ArrowRight className="size-4" />
            </Link>
          </section>

          <Link href="/profile/settings" className="flex items-center gap-2 text-small text-muted hover:text-fg">
            <Settings2 className="size-4" /> Preferências de estudo e notificações
          </Link>
        </aside>
      </div>
    </div>
  );
}

function buildActivity(rows: { date: Date; seconds: number }[]) {
  const map = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r.seconds]));
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    return { key, date: d, minutes: Math.round((map.get(key) ?? 0) / 60) };
  });
  const max = Math.max(30, ...days.map((d) => d.minutes));
  return { days, max, total: days.reduce((s, d) => s + d.minutes * 60, 0) };
}
