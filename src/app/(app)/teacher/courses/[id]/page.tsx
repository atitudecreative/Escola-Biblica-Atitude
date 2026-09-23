import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, ClipboardList, ListChecks, MessageSquare, Users } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { NotFoundError, ForbiddenError } from "@/server/errors";
import { builderLookups, canPublishDirectly, getBuilderCourse, publishChecklist } from "@/server/services/course-builder";
import { courseAssessments, courseStudents } from "@/server/services/teacher";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CurriculumEditor, type CurriculumModule } from "@/components/teacher/curriculum-editor";
import { PublishControls } from "@/components/teacher/publish-controls";
import { CourseDetailsForm } from "@/components/teacher/course-details-form";
import { CourseSettingsForm } from "@/components/teacher/course-settings-form";
import { AnnouncementDialog } from "@/components/teacher/announcement-dialog";
import { COURSE_STATUS, ENROLLMENT_STATUS } from "@/lib/labels";
import { formatDate, formatDuration, formatNumber, formatPercent, pluralize, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "content", label: "Conteúdo" },
  { key: "details", label: "Detalhes" },
  { key: "assessments", label: "Avaliações" },
  { key: "students", label: "Alunos" },
  { key: "settings", label: "Configurações" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata(props: PageProps<"/teacher/courses/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const c = await db.course.findUnique({ where: { id }, select: { title: true } });
  return { title: c ? `${c.title} · Editor` : "Curso" };
}

function hasContent(l: { type: string; videoUrl: string | null; mediaFileId: string | null; externalUrl: string | null; content: string; quiz: { _count: { questions: number } } | null }) {
  switch (l.type) {
    case "VIDEO":
      return !!(l.videoUrl || l.mediaFileId);
    case "TEXT":
      return l.content.trim().length > 0;
    case "LINK":
      return !!l.externalUrl;
    case "QUIZ":
      return (l.quiz?._count.questions ?? 0) > 0;
    case "ASSIGNMENT":
      return true;
    default:
      return !!l.mediaFileId;
  }
}

export default async function CourseBuilderPage(props: PageProps<"/teacher/courses/[id]">) {
  const user = await requirePermissionPage("courses.manage_own", "courses.manage_any");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "content";

  let course;
  try {
    course = await getBuilderCourse(user, id);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) notFound();
    throw e;
  }
  const [checklist, direct] = await Promise.all([publishChecklist(id), canPublishDirectly(user)]);

  const modules: CurriculumModule[] = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      type: l.type,
      durationSeconds: l.durationSeconds,
      isPreview: l.isPreview,
      isPublished: l.isPublished,
      materials: l._count.materials,
      questions: l.quiz ? l.quiz._count.questions : null,
      hasContent: hasContent(l),
    })),
  }));
  const firstLesson = course.modules.flatMap((m) => m.lessons).find((l) => l.isPublished) ?? course.modules.flatMap((m) => m.lessons)[0];
  const published = course.modules.flatMap((m) => m.lessons).filter((l) => l.isPublished);
  const ready = checklist.every((c) => !c.required || c.ok);
  const status = COURSE_STATUS[course.status];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ensino", href: "/teacher" }, { label: "Meus cursos", href: "/teacher/courses" }, { label: course.title }]}
        title={course.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={status.tone} dot>{status.label}</Badge>
            <span>{pluralize(course.modules.length, "módulo", "módulos")}</span>
            <span aria-hidden>·</span>
            <span>{pluralize(published.length, "aula publicada", "aulas publicadas")}</span>
            <span aria-hidden>·</span>
            <span>{formatDuration(course.durationMinutes * 60)}</span>
            <span aria-hidden>·</span>
            <span>{pluralize(course._count.enrollments, "aluno", "alunos")}</span>
            {course.instructorId !== user.id && (
              <>
                <span aria-hidden>·</span>
                <span>Professor: {course.instructor.name}</span>
              </>
            )}
          </span>
        }
        actions={
          <PublishControls
            courseId={course.id}
            status={course.status}
            slug={course.slug}
            firstLessonId={firstLesson?.id ?? null}
            canPublishDirectly={direct}
            isOwner={course.instructorId === user.id}
            ready={ready}
          />
        }
      />

      {sp.created && (
        <Alert tone="success" title="Rascunho criado" className="mb-6">
          Agora monte o currículo: renomeie o primeiro módulo e adicione as aulas. Nada fica visível para alunos até você publicar.
        </Alert>
      )}
      {course.status === "REVIEW" && (
        <Alert tone="warning" title="Em revisão" className="mb-6">
          {direct ? "Este curso aguarda sua aprovação. Revise o conteúdo e publique, ou devolva ao professor com orientações." : "A coordenação está revisando este curso. Você pode continuar editando; avisaremos quando for publicado."}
        </Alert>
      )}
      {course.status === "ARCHIVED" && (
        <Alert tone="info" title="Curso arquivado" className="mb-6">
          Fora do catálogo e sem novas matrículas. Quem já estava matriculado continua com acesso.
        </Alert>
      )}

      <nav aria-label="Seções do curso" className="-mx-4 mb-6 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ul className="-mb-px flex gap-1">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={t.key === "content" ? `/teacher/courses/${id}` : `/teacher/courses/${id}?tab=${t.key}`}
                scroll={false}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 shrink-0 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
                  tab === t.key ? "text-fg after:bg-primary" : "text-muted hover:text-fg after:bg-transparent",
                )}
              >
                {t.label}
                {t.key === "students" && <span className="text-caption text-subtle tabular-nums">{course._count.enrollments}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "content" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <CurriculumEditor courseId={course.id} initial={modules} coursePublished={course.status === "PUBLISHED"} />
          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <h2 className="text-h4">{course.status === "PUBLISHED" ? "Qualidade do curso" : "Antes de publicar"}</h2>
              <ul className="mt-3 space-y-2.5">
                {checklist.map((c) => (
                  <li key={c.key} className="flex items-start gap-2.5 text-small">
                    {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className={cn("mt-0.5 size-4 shrink-0", c.required ? "text-warning" : "text-subtle")} aria-hidden />}
                    <span className={cn(c.ok ? "text-muted" : "text-fg")}>
                      {c.label}
                      {c.required && !c.ok && <span className="ml-1 text-caption font-medium text-warning">obrigatório</span>}
                      <span className="sr-only">{c.ok ? " (concluído)" : " (pendente)"}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {checklist.some((c) => !c.ok && !c.required) && (
                <Link href={`/teacher/courses/${id}?tab=details`} className="mt-3 inline-flex h-8 items-center text-small font-medium text-primary hover:underline">
                  Completar detalhes
                </Link>
              )}
            </section>
            <p className="px-1 text-caption text-subtle">
              A duração total ({formatDuration(course.durationMinutes * 60)}) é a soma das aulas publicadas e é atualizada automaticamente.
            </p>
          </aside>
        </div>
      )}

      {tab === "details" && <DetailsTab course={course} />}
      {tab === "assessments" && <AssessmentsTab courseId={course.id} />}
      {tab === "students" && <StudentsTab courseId={course.id} courseTitle={course.title} canAnnounce={user.permissions.has("announcements.course") || user.permissions.has("announcements.all")} />}
      {tab === "settings" && <SettingsTab course={course} canFeature={user.permissions.has("courses.manage_any")} />}
    </>
  );
}

type BuilderCourse = Awaited<ReturnType<typeof getBuilderCourse>>;

async function DetailsTab({ course }: { course: BuilderCourse }) {
  const { categories, tags } = await builderLookups();
  const faq = Array.isArray(course.faq) ? (course.faq as { question?: unknown; answer?: unknown }[]) : [];
  return (
    <CourseDetailsForm
      categories={categories}
      tagSuggestions={tags.map((t) => t.name)}
      categoryName={course.category?.name}
      initial={{
        courseId: course.id,
        title: course.title,
        subtitle: course.subtitle ?? "",
        slug: course.slug,
        description: course.description,
        coverUrl: course.coverUrl ?? "",
        trailerUrl: course.trailerUrl ?? "",
        categoryId: course.categoryId ?? "",
        level: course.level,
        language: course.language,
        workloadHours: course.workloadHours,
        tags: course.tags.map((t) => t.tag.name),
        objectives: course.objectives,
        requirements: course.requirements,
        targetAudience: course.targetAudience,
        faq: faq.map((f) => ({ question: String(f.question ?? ""), answer: String(f.answer ?? "") })),
      }}
    />
  );
}

async function SettingsTab({ course, canFeature }: { course: BuilderCourse; canFeature: boolean }) {
  const { templates } = await builderLookups();
  return (
    <div className="max-w-3xl">
      <CourseSettingsForm
        templates={templates}
        canFeature={canFeature}
        initial={{
          courseId: course.id,
          sequential: course.sequential,
          certificateEnabled: course.certificateEnabled,
          certificateTemplateId: course.certificateTemplateId ?? "",
          priceCents: course.priceCents,
          isFeatured: course.isFeatured,
        }}
      />
    </div>
  );
}

async function AssessmentsTab({ courseId }: { courseId: string }) {
  const { quizzes, assignments } = await courseAssessments(courseId);
  if (!quizzes.length && !assignments.length) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nenhuma avaliação neste curso"
        description="Crie uma aula do tipo Questionário ou Atividade na aba Conteúdo para avaliar seus alunos."
        action={
          <Button asChild>
            <Link href={`/teacher/courses/${courseId}`}>Ir para o conteúdo</Link>
          </Button>
        }
      />
    );
  }
  const lessonHref = (lessonId: string | null) => (lessonId ? `/teacher/courses/${courseId}/lessons/${lessonId}` : "#");
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-h4"><ListChecks className="size-4 text-subtle" /> Questionários</h2>
        {quizzes.length === 0 ? (
          <p className="text-small text-subtle">Nenhum questionário.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            {quizzes.map((q) => (
              <li key={q.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <Link href={lessonHref(q.lessonId)} className="font-medium text-fg hover:text-primary">{q.title}</Link>
                  <p className="text-caption text-subtle">
                    {q.lesson?.module.title} · {pluralize(q._count.questions, "questão", "questões")} · nota mínima {q.passingScore}% · {q.maxAttempts ? pluralize(q.maxAttempts, "tentativa", "tentativas") : "tentativas ilimitadas"}
                    {q.lesson && !q.lesson.isPublished && " · rascunho"}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-small sm:w-80">
                  <div><dt className="text-caption text-subtle">Tentativas</dt><dd className="font-medium tabular-nums">{formatNumber(q.attemptsCount)}</dd></div>
                  <div><dt className="text-caption text-subtle">Nota média</dt><dd className="font-medium tabular-nums">{q.avg != null ? formatPercent(q.avg) : "—"}</dd></div>
                  <div><dt className="text-caption text-subtle">Aprovação</dt><dd className="font-medium tabular-nums">{q.passRate != null ? formatPercent(q.passRate) : "—"}</dd></div>
                </dl>
                {q.pending > 0 && (
                  <Button asChild size="sm" variant="outline"><Link href={`/teacher/grading?course=${courseId}&kind=quiz`}>Corrigir {q.pending}</Link></Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-h4"><ClipboardList className="size-4 text-subtle" /> Atividades</h2>
        {assignments.length === 0 ? (
          <p className="text-small text-subtle">Nenhuma atividade.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            {assignments.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <Link href={lessonHref(a.lessonId)} className="font-medium text-fg hover:text-primary">{a.title}</Link>
                  <p className="text-caption text-subtle">
                    {a.lesson?.module.title} · nota máxima {a.maxScore} · {a.dueAt ? `prazo ${formatDate(a.dueAt)}` : "sem prazo"}
                    {a.lesson && !a.lesson.isPublished && " · rascunho"}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-small sm:w-80">
                  <div><dt className="text-caption text-subtle">Entregas</dt><dd className="font-medium tabular-nums">{formatNumber(a.total)}</dd></div>
                  <div><dt className="text-caption text-subtle">Aprovadas</dt><dd className="font-medium tabular-nums">{formatNumber(a.approved)}</dd></div>
                  <div><dt className="text-caption text-subtle">Nota média</dt><dd className="font-medium tabular-nums">{a.avg != null ? formatNumber(a.avg, 1) : "—"}</dd></div>
                </dl>
                {a.pending > 0 ? (
                  <Button asChild size="sm"><Link href={`/teacher/grading?course=${courseId}&kind=assignment`}>Corrigir {a.pending}</Link></Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function StudentsTab({ courseId, courseTitle, canAnnounce }: { courseId: string; courseTitle: string; canAnnounce: boolean }) {
  const rows = await courseStudents(courseId);
  if (!rows.length) {
    return <EmptyState icon={Users} title="Nenhum aluno matriculado" description="Quando o curso estiver publicado, os alunos matriculados aparecem aqui com o progresso de cada um." />;
  }
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-muted">{pluralize(rows.length, "aluno matriculado", "alunos matriculados")} · {pluralize(rows.filter((r) => r.status === "COMPLETED").length, "concluiu", "concluíram")}</p>
        {canAnnounce && <AnnouncementDialog courses={[{ id: courseId, title: courseTitle }]} defaultCourseId={courseId} />}
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
        <Table>
          <THead>
            <tr>
              <TH>Aluno</TH>
              <TH className="w-48">Progresso</TH>
              <TH>Status</TH>
              <TH>Última atividade</TH>
              <TH className="w-12"><span className="sr-only">Ações</span></TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={r.user.name} src={r.user.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.user.name}</p>
                      <p className="truncate text-caption text-subtle">{r.user.email}</p>
                    </div>
                  </div>
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <Progress value={r.progressPercent} size="sm" tone={r.status === "COMPLETED" ? "success" : "primary"} className="w-24" label={`Progresso de ${r.user.name}`} />
                    <span className="text-caption text-muted tabular-nums">{r.progressPercent}%</span>
                  </div>
                </TD>
                <TD><Badge tone={ENROLLMENT_STATUS[r.status].tone}>{ENROLLMENT_STATUS[r.status].label}</Badge></TD>
                <TD className="text-small text-muted">
                  <p>{r.lastAccessedAt ? timeAgo(r.lastAccessedAt) : "Ainda não acessou"}</p>
                  {r.lastLesson && <p className="max-w-56 truncate text-caption text-subtle">{r.lastLesson.title}</p>}
                </TD>
                <TD>
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`Enviar mensagem para ${r.user.name}`}>
                    <Link href={`/messages?to=${r.user.id}`}><MessageSquare /></Link>
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 p-3">
            <Avatar name={r.user.name} src={r.user.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.user.name}</p>
              <div className="mt-1 flex items-center gap-2">
                <Progress value={r.progressPercent} size="sm" tone={r.status === "COMPLETED" ? "success" : "primary"} label={`Progresso de ${r.user.name}`} />
                <span className="text-caption text-muted tabular-nums">{r.progressPercent}%</span>
              </div>
              <p className="mt-0.5 text-caption text-subtle">{r.lastAccessedAt ? `Ativo ${timeAgo(r.lastAccessedAt)}` : "Ainda não acessou"}</p>
            </div>
            <Button asChild variant="ghost" size="icon" aria-label={`Enviar mensagem para ${r.user.name}`}>
              <Link href={`/messages?to=${r.user.id}`}><MessageSquare /></Link>
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
