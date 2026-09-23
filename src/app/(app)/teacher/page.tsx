import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookPlus, CheckCircle2, ClipboardCheck, ClipboardPlus, FilePlus2, HelpCircle, Hourglass, Megaphone, PenLine } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { teacherCourseOptions, teacherDashboard } from "@/server/services/teacher";
import { PageHeader } from "@/components/ui/page-header";
import { StatStrip } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ActivityChart, CourseProgressChart, QuizPerformance, StudentsPerCourse } from "@/components/teacher/dashboard-charts";
import { AnnouncementDialog } from "@/components/teacher/announcement-dialog";
import { QuickLessonDialog } from "@/components/teacher/quick-lesson-dialog";
import { formatNumber, formatPercent, pluralize, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Painel do professor" };

export default async function TeacherDashboardPage() {
  const user = await requirePermissionPage("courses.manage_own", "courses.create", "courses.manage_any");
  const [d, options] = await Promise.all([teacherDashboard(user), teacherCourseOptions(user)]);
  const k = d.kpis;
  const first = user.name.replace(/^(Pr\.|Pra\.|Prof\.|Profa\.|Dr\.|Dra\.)\s+/i, "").split(" ")[0];
  const publishedCourses = d.courses.filter((c) => c.status === "PUBLISHED" || c.status === "ARCHIVED");
  const hasCourses = d.courses.length > 0;
  const attentionCount = d.attention.submissions.length + (d.attention.pendingAttempts ? 1 : 0) + d.attention.reviewCourses.length + (k.openQuestions ? 1 : 0);

  const shortcut = "group flex min-h-16 w-full bg-surface items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";
  const icon = "flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:bg-primary-soft group-hover:text-primary";

  return (
    <>
      <PageHeader
        eyebrow="Ensino"
        title={`Olá, ${first}`}
        description="Acompanhe suas turmas, corrija entregas e mantenha seus cursos em dia."
        actions={
          <Button asChild>
            <Link href="/teacher/courses">
              Meus cursos <ArrowRight />
            </Link>
          </Button>
        }
      />

      {/* Atalhos */}
      <nav aria-label="Atalhos" className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/teacher/courses/new" className={shortcut}>
          <span className={icon}><BookPlus className="size-4" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-fg">Novo curso</span>
            <span className="block truncate text-caption text-subtle">Comece um rascunho</span>
          </span>
        </Link>
        <QuickLessonDialog
          courses={options}
          kind="lesson"
          trigger={
            <button className={shortcut}>
              <span className={icon}><FilePlus2 className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">Nova aula</span>
                <span className="block truncate text-caption text-subtle">Vídeo, texto, PDF, questionário…</span>
              </span>
            </button>
          }
        />
        <QuickLessonDialog
          courses={options}
          kind="assignment"
          trigger={
            <button className={shortcut}>
              <span className={icon}><ClipboardPlus className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">Nova atividade</span>
                <span className="block truncate text-caption text-subtle">Entrega com prazo e nota</span>
              </span>
            </button>
          }
        />
        <AnnouncementDialog
          courses={publishedCourses}
          trigger={
            <button className={shortcut}>
              <span className={icon}><Megaphone className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">Enviar comunicado</span>
                <span className="block truncate text-caption text-subtle">Avise uma turma inteira</span>
              </span>
            </button>
          }
        />
      </nav>

      {!hasCourses ? (
        <EmptyState
          icon={BookPlus}
          title="Crie seu primeiro curso"
          description="Organize módulos e aulas, adicione avaliações e publique para seus alunos. Os indicadores aparecem aqui assim que houver turma."
          action={
            <Button asChild>
              <Link href="/teacher/courses/new">Criar curso</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <StatStrip
            items={[
              { label: "Cursos publicados", value: formatNumber(k.published), hint: `${pluralize(k.drafts, "rascunho", "rascunhos")} · ${formatNumber(k.inReview)} em revisão` },
              { label: "Alunos", value: formatNumber(k.students), hint: `${formatNumber(k.activeLast7)} ativos nos últimos 7 dias` },
              { label: "Taxa de conclusão", value: formatPercent(k.completionRate), hint: `${pluralize(k.lessons, "aula publicada", "aulas publicadas")}` },
              { label: "Horas assistidas", value: formatNumber(k.hoursWatched, k.hoursWatched < 10 ? 1 : 0), hint: "Tempo total de estudo" },
              {
                label: "Avaliação dos cursos",
                value: k.ratingCount ? formatNumber(k.ratingAvg, 1) : "—",
                hint: k.quizAvg != null ? `Nota média em questionários: ${formatPercent(k.quizAvg)}` : pluralize(k.ratingCount, "avaliação", "avaliações"),
              },
              { label: "Pendências", value: formatNumber(k.pendingGrading + k.openQuestions), hint: `${formatNumber(k.pendingGrading)} correções · ${formatNumber(k.openQuestions)} dúvidas` },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <ActivityChart data={d.daily} />
            </div>

            <section aria-labelledby="attention" className="flex min-w-0 flex-col rounded-xl border border-border bg-surface shadow-xs">
              <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
                <div>
                  <h2 id="attention" className="text-h4">Precisa da sua atenção</h2>
                  <p className="mt-0.5 text-small text-muted">{attentionCount ? "Itens aguardando você" : "Nada pendente agora"}</p>
                </div>
                {k.pendingGrading > 0 && <Badge tone="warning">{formatNumber(k.pendingGrading)}</Badge>}
              </div>
              {attentionCount === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 pb-8 text-center">
                  <CheckCircle2 className="size-6 text-success" aria-hidden />
                  <p className="text-sm font-medium">Tudo em dia</p>
                  <p className="text-small text-muted">Nenhuma entrega aguardando correção.</p>
                </div>
              ) : (
                <ul className="flex-1 divide-y divide-border border-t border-border">
                  {d.attention.submissions.map((s) => (
                    <li key={s.id}>
                      <Link href={`/teacher/grading/submission/${s.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                        <Avatar name={s.user.name} src={s.user.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">
                            <span className="font-medium">{s.user.name}</span> enviou {s.assignment.title}
                          </span>
                          <span className="block truncate text-caption text-subtle">
                            {s.assignment.course.title} · {timeAgo(s.submittedAt)}
                          </span>
                        </span>
                        <ClipboardCheck className="size-4 shrink-0 text-subtle" aria-hidden />
                      </Link>
                    </li>
                  ))}
                  {d.attention.pendingAttempts > 0 && (
                    <li>
                      <Link href="/teacher/grading?kind=quiz" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                        <span className="flex size-8 items-center justify-center rounded-full bg-info-soft text-info"><PenLine className="size-4" /></span>
                        <span className="min-w-0 flex-1 text-sm">{pluralize(d.attention.pendingAttempts, "questionário com resposta aberta", "questionários com respostas abertas")} para corrigir</span>
                      </Link>
                    </li>
                  )}
                  {d.attention.reviewCourses.map((c) => (
                    <li key={c.id}>
                      <Link href={`/teacher/courses/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                        <span className="flex size-8 items-center justify-center rounded-full bg-warning-soft text-warning"><Hourglass className="size-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">{c.title}</span>
                          <span className="block text-caption text-subtle">Em revisão pela coordenação · {timeAgo(c.updatedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  {k.openQuestions > 0 && (
                    <li>
                      <Link href="/community/questions" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                        <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg"><HelpCircle className="size-4" /></span>
                        <span className="min-w-0 flex-1 text-sm">{pluralize(k.openQuestions, "dúvida sem resposta", "dúvidas sem resposta")} na comunidade</span>
                      </Link>
                    </li>
                  )}
                </ul>
              )}
              {k.pendingGrading > 0 && (
                <div className="border-t border-border px-4 py-2.5 sm:px-5">
                  <Link href="/teacher/grading" className="inline-flex h-8 items-center gap-1 text-small font-medium text-primary hover:underline">
                    Abrir fila de correção <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <CourseProgressChart data={d.perCourse} />
            </div>
            <StudentsPerCourse data={d.perCourse} />
          </div>
          <QuizPerformance data={d.quizPerf} />
        </div>
      )}
    </>
  );
}
