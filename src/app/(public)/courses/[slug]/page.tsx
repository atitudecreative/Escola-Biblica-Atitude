import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award, BarChart3, CheckCircle2, CircleCheck, Clock, Download, ExternalLink, FileText, Globe, Languages, Layers,
  ListChecks, Lock, PlayCircle, Star, Users,
} from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { getCoursePage } from "@/server/services/catalog";
import { nextLessonFor } from "@/server/services/learning";
import { env } from "@/server/env";
import { CourseCover } from "@/components/course/course-cover";
import { EnrollButton, FavoriteButton, ReviewForm } from "@/components/course/course-actions";
import { LessonTypeIcon } from "@/components/course/lesson-type-icon";
import { Markdown } from "@/components/markdown";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Progress } from "@/components/ui/progress";
import { Alert } from "@/components/ui/alert";
import { COURSE_LEVEL, COURSE_STATUS, LESSON_TYPE } from "@/lib/labels";
import { formatBytes, formatDate, formatDuration, formatNumber, pluralize } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCoursePage(slug, null);
  if (!data) return { title: "Curso não encontrado" };
  const { course } = data;
  return {
    title: course.title,
    description: course.subtitle ?? course.description.slice(0, 160),
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: { title: course.title, description: course.subtitle ?? undefined, type: "website", url: `/courses/${course.slug}` },
  };
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const { slug } = await params;
  const user = await getSessionUser();
  const data = await getCoursePage(slug, user);
  if (!data) notFound();
  const { course, enrollment, manager, ratingDist, isFavorite, myReview, completedIds, lessonCount } = data;

  const state = !enrollment ? "none" : enrollment.status === "COMPLETED" ? "completed" : "active";
  const firstLesson = course.modules.flatMap((m) => m.lessons)[0];
  const nextId = enrollment && user ? await nextLessonFor(user.id, course.id) : null;
  const continueHref = nextId ? `/learn/${course.id}/${nextId}` : manager && firstLesson ? `/learn/${course.id}/${firstLesson.id}` : null;
  const totalSeconds = course.modules.reduce((s, m) => s + m.lessons.reduce((a, l) => a + l.durationSeconds, 0), 0);
  const faq = (Array.isArray(course.faq) ? course.faq : []) as { question: string; answer: string }[];
  const totalReviews = Object.values(ratingDist).reduce((a, b) => a + b, 0);
  const paid = course.priceCents > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.subtitle ?? course.description.slice(0, 300),
    provider: { "@type": "Organization", name: "Escola Bíblica Atitude", sameAs: env.APP_URL },
    inLanguage: course.language,
    ...(course.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: course.ratingAvg.toFixed(1), ratingCount: course.ratingCount } } : {}),
  };

  const includes = [
    { icon: PlayCircle, text: `${pluralize(lessonCount, "aula", "aulas")} · ${formatDuration(totalSeconds)}` },
    { icon: Download, text: pluralize(course._count.materials, "material para download", "materiais para download") },
    ...(course._count.quizzes ? [{ icon: ListChecks, text: pluralize(course._count.quizzes, "avaliação", "avaliações") }] : []),
    ...(course.certificateEnabled ? [{ icon: Award, text: `Certificado de ${course.workloadHours}h` }] : []),
    { icon: Globe, text: "Acesso ilimitado, no celular ou computador" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Cabeçalho */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:py-14">
          <div className="min-w-0">
            <Breadcrumbs
              items={[{ label: "Cursos", href: "/courses" }, ...(course.category ? [{ label: course.category.name, href: `/courses?category=${course.category.slug}` }] : []), { label: course.title }]}
              className="mb-6"
            />
            {course.status !== "PUBLISHED" && (
              <Alert tone="warning" className="mb-5" title={`Este curso está ${COURSE_STATUS[course.status].label.toLowerCase()}`}>
                {manager ? "Você está vendo a página como gestor do curso. Alunos só verão após a publicação." : "Novas matrículas estão encerradas."}
              </Alert>
            )}
            <h1 className="font-display text-[2.25rem] leading-[1.1] tracking-tight text-balance sm:text-[2.75rem]">{course.title}</h1>
            {course.subtitle && <p className="mt-4 max-w-2xl text-[1.0625rem] text-muted">{course.subtitle}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              {course.ratingCount > 0 && (
                <a href="#avaliacoes" className="inline-flex items-center gap-1.5 font-medium text-fg hover:underline">
                  <Star className="size-4 fill-accent text-accent" /> {formatNumber(course.ratingAvg, 1)}
                  <span className="font-normal text-muted">({pluralize(course.ratingCount, "avaliação", "avaliações")})</span>
                </a>
              )}
              <span className="inline-flex items-center gap-1.5"><Users className="size-4" /> {pluralize(course.enrollmentCount, "aluno", "alunos")}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> {formatDuration(totalSeconds)}</span>
              <span className="inline-flex items-center gap-1.5"><BarChart3 className="size-4" /> {COURSE_LEVEL[course.level]}</span>
              <span className="inline-flex items-center gap-1.5"><Languages className="size-4" /> Português</span>
            </div>
            <Link href={`/teachers/${course.instructor.id}`} className="mt-6 inline-flex items-center gap-3 rounded-lg pr-3 transition hover:bg-surface-2">
              <Avatar name={course.instructor.name} src={course.instructor.avatarUrl} />
              <span>
                <span className="block text-caption text-subtle">Professor(a)</span>
                <span className="block text-sm font-medium">{course.instructor.name}</span>
              </span>
            </Link>
            {course.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {course.tags.map((t) => (
                  <Link key={t.tagId} href={`/courses?q=${encodeURIComponent(t.tag.name)}`}>
                    <Badge className="hover:bg-surface-3">{t.tag.name}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Cartão de ação */}
          <aside className="lg:row-span-2">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-md lg:sticky lg:top-24">
              <CourseCover title={course.title} category={course.category?.name} tone={course.category?.position} src={course.coverUrl} />
              <div className="p-5">
                {enrollment && (
                  <div className="mb-5">
                    <div className="mb-1.5 flex justify-between text-small">
                      <span className="text-muted">{state === "completed" ? "Curso concluído" : "Seu progresso"}</span>
                      <span className="font-semibold tabular-nums">{enrollment.progressPercent}%</span>
                    </div>
                    <Progress value={enrollment.progressPercent} tone={state === "completed" ? "success" : "primary"} />
                  </div>
                )}
                {!enrollment && <p className="mb-4 text-h2">{paid ? "Curso pago" : "Gratuito"}</p>}
                <div className="flex gap-2">
                  <EnrollButton courseId={course.id} state={state} continueHref={continueHref} loggedIn={!!user} slug={course.slug} paid={paid && !enrollment} className="flex-1" />
                  {user && <FavoriteButton type="COURSE" id={course.id} initial={isFavorite} label={false} />}
                </div>
                {paid && !enrollment && <p className="mt-2 text-caption text-muted">A inscrição online em cursos pagos ainda não está disponível. Fale com a secretaria.</p>}
                {manager && (
                  <Link href={`/teacher/courses/${course.id}`} className="mt-3 block text-center text-small font-medium text-primary hover:underline">
                    Editar no construtor de cursos
                  </Link>
                )}
                <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                  {includes.map((it) => (
                    <li key={it.text} className="flex items-center gap-2.5 text-sm text-muted">
                      <it.icon className="size-4 shrink-0 text-subtle" /> {it.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <div className="min-w-0 space-y-14">
          {course.objectives.length > 0 && (
            <section>
              <h2 className="text-h2">O que você vai aprender</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {course.objectives.map((o) => (
                  <li key={o} className="flex gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="conteudo" className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-h2">Conteúdo do curso</h2>
              <p className="text-small text-muted">
                {pluralize(course.modules.length, "módulo", "módulos")} · {pluralize(lessonCount, "aula", "aulas")} · {formatDuration(totalSeconds)}
              </p>
            </div>
            <div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface">
              <Accordion type="multiple" defaultValue={course.modules.slice(0, 1).map((m) => m.id)}>
                {course.modules.map((m, mi) => {
                  const done = m.lessons.filter((l) => completedIds.has(l.id)).length;
                  return (
                    <AccordionItem key={m.id} value={m.id}>
                      <AccordionTrigger className="px-5">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-caption font-normal text-subtle">Módulo {mi + 1}</span>
                          <span className="truncate">{m.title}</span>
                        </span>
                        <span className="ml-auto shrink-0 pr-2 text-caption font-normal text-subtle">
                          {enrollment ? `${done}/${m.lessons.length}` : pluralize(m.lessons.length, "aula", "aulas")}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        <ul>
                          {m.lessons.map((l) => {
                            const completed = completedIds.has(l.id);
                            const canOpen = !!enrollment || manager || l.isPreview;
                            const inner = (
                              <>
                                {completed ? (
                                  <CircleCheck className="size-4 shrink-0 text-success" aria-label="Concluída" />
                                ) : (
                                  <LessonTypeIcon type={l.type} className="size-4 shrink-0 text-subtle" />
                                )}
                                <span className="min-w-0 flex-1 truncate text-fg">{l.title}</span>
                                {l.isPreview && !enrollment && <Badge tone="primary">Prévia</Badge>}
                                {!canOpen && <Lock className="size-3.5 text-subtle" aria-label="Disponível após a matrícula" />}
                                <span className="w-16 shrink-0 text-right text-caption text-subtle tabular-nums">
                                  <span className="sr-only">{LESSON_TYPE[l.type]}, </span>
                                  {formatDuration(l.durationSeconds)}
                                </span>
                              </>
                            );
                            return (
                              <li key={l.id}>
                                {canOpen ? (
                                  <Link href={`/learn/${course.id}/${l.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm transition hover:bg-surface-2">
                                    {inner}
                                  </Link>
                                ) : (
                                  <div className="flex items-center gap-3 px-5 py-2.5 text-sm">{inner}</div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </section>

          {course.description && (
            <section>
              <h2 className="text-h2">Sobre o curso</h2>
              <Markdown className="mt-4 text-muted">{course.description}</Markdown>
            </section>
          )}

          {(course.requirements.length > 0 || course.targetAudience.length > 0) && (
            <section className="grid gap-8 sm:grid-cols-2">
              {course.requirements.length > 0 && (
                <div>
                  <h2 className="text-h3">Requisitos</h2>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
                    {course.requirements.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}
              {course.targetAudience.length > 0 && (
                <div>
                  <h2 className="text-h3">Para quem é</h2>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
                    {course.targetAudience.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}
            </section>
          )}

          {course.materials.length > 0 && (
            <section id="materiais" className="scroll-mt-24">
              <h2 className="text-h2">Materiais do curso</h2>
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
                {course.materials.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      {m.kind === "LINK" ? <ExternalLink className="size-4" /> : <FileText className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="text-caption text-subtle">
                        {m.kind === "LINK" ? "Link externo" : `${m.file?.mimeType.split("/")[1]?.toUpperCase() ?? "Arquivo"} · ${formatBytes(m.file?.sizeBytes ?? 0)}`}
                      </p>
                    </div>
                    {enrollment || manager ? (
                      m.kind === "LINK" && m.url ? (
                        <a href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="text-small font-medium text-primary hover:underline">Abrir</a>
                      ) : m.file ? (
                        <a href={`/api/files/${m.file.id}?download=1`} className="text-small font-medium text-primary hover:underline">Baixar</a>
                      ) : null
                    ) : (
                      <span className="inline-flex items-center gap-1 text-caption text-subtle"><Lock className="size-3.5" /> Após matrícula</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-h2">Seu professor</h2>
            <div className="mt-5 flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 sm:flex-row">
              <Avatar name={course.instructor.name} src={course.instructor.avatarUrl} size="xl" />
              <div>
                <Link href={`/teachers/${course.instructor.id}`} className="text-h3 hover:text-primary">{course.instructor.name}</Link>
                {course.instructor.headline && <p className="text-sm text-muted">{course.instructor.headline}</p>}
                {course.instructor.bio && <p className="mt-3 text-sm leading-relaxed text-muted">{course.instructor.bio}</p>}
              </div>
            </div>
          </section>

          <section id="avaliacoes" className="scroll-mt-24">
            <h2 className="text-h2">Avaliações dos alunos</h2>
            {totalReviews === 0 ? (
              <p className="mt-3 text-sm text-muted">Este curso ainda não recebeu avaliações.</p>
            ) : (
              <div className="mt-5 grid gap-8 sm:grid-cols-[180px_minmax(0,1fr)]">
                <div>
                  <p className="text-[3rem] leading-none font-semibold tracking-tight">{formatNumber(course.ratingAvg, 1)}</p>
                  <div className="mt-2 flex gap-0.5" aria-label={`${formatNumber(course.ratingAvg, 1)} de 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`size-4 ${n <= Math.round(course.ratingAvg) ? "fill-accent text-accent" : "text-border-strong"}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-caption text-subtle">{pluralize(totalReviews, "avaliação", "avaliações")}</p>
                  <ul className="mt-4 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <li key={n} className="flex items-center gap-2 text-caption text-muted">
                        <span className="w-3 tabular-nums">{n}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${((ratingDist[n] ?? 0) / totalReviews) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="space-y-5">
                  {course.reviews.filter((r) => r.comment).map((r) => (
                    <li key={r.id} className="border-b border-border pb-5 last:border-0">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.user.name} src={r.user.avatarUrl} size="sm" />
                        <div>
                          <p className="text-sm font-medium">{r.user.name}</p>
                          <p className="flex items-center gap-1.5 text-caption text-subtle">
                            <span className="flex">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-3 fill-accent text-accent" />)}</span>
                            {formatDate(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted">{r.comment}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {enrollment && (
              <div className="mt-6 max-w-lg">
                <ReviewForm courseId={course.id} initial={myReview} />
              </div>
            )}
          </section>

          {faq.length > 0 && (
            <section>
              <h2 className="text-h2">Perguntas frequentes</h2>
              <Accordion type="single" collapsible className="mt-4 rounded-xl border border-border bg-surface px-5">
                {faq.map((f, i) => (
                  <AccordionItem key={i} value={String(i)}>
                    <AccordionTrigger>{f.question}</AccordionTrigger>
                    <AccordionContent>{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}
        </div>

        {course.certificateEnabled && (
          <aside className="hidden lg:block">
            <div className="rounded-xl border border-border bg-surface p-5">
              <Award className="size-5 text-accent" />
              <p className="mt-3 text-h4">Certificado de conclusão</p>
              <p className="mt-1 text-sm text-muted">
                Conclua todas as aulas para receber um certificado de {course.workloadHours} horas, com código único e QR Code para validação pública.
              </p>
              <p className="mt-4 flex items-center gap-2 text-caption text-subtle"><Layers className="size-3.5" /> {pluralize(course.modules.length, "módulo", "módulos")}</p>
            </div>
          </aside>
        )}
      </div>

      {/* CTA fixo no mobile */}
      <div className="sticky bottom-0 z-30 border-t border-border bg-surface/95 p-3 backdrop-blur-md lg:hidden">
        <EnrollButton courseId={course.id} state={state} continueHref={continueHref} loggedIn={!!user} slug={course.slug} paid={paid && !enrollment} className="w-full" />
      </div>
    </>
  );
}
