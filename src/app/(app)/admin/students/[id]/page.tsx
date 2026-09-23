import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Award, BookOpen, ClipboardList, History, MessageSquare, Trophy, FileQuestion } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { courseOptions, getStudentDetail } from "@/server/services/users-admin";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatStrip } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartCard } from "@/components/analytics/chart-cards";
import { ProfileActions } from "@/components/admin/people/user-actions";
import { EnrollDialogButton, RemoveEnrollmentButton } from "@/components/admin/people/enrollment-actions";
import { auditLabel } from "@/components/admin/people/audit-labels";
import { ENROLLMENT_STATUS, SUBMISSION_STATUS, USER_STATUS } from "@/lib/labels";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate, formatDateTime, formatDuration, formatNumber, formatShortDate, timeAgo } from "@/lib/format";
import { isoDay, startOfUtcDay } from "@/lib/analytics-period";

export const metadata: Metadata = { title: "Aluno" };

const SOURCE: Record<string, string> = { SELF: "Autoinscrição", ADMIN: "Secretaria", PURCHASE: "Compra" };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-small text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-small text-fg">{children}</dd>
    </div>
  );
}

export default async function StudentDetailPage(props: PageProps<"/admin/students/[id]">) {
  const me = await requirePermissionPage("students.view_all", "users.view");
  const { id } = await props.params;
  const [data, allCourses] = await Promise.all([getStudentDetail(id), courseOptions()]);
  if (!data) notFound();
  const { user, stats, level } = data;
  const canManage = me.permissions.has("users.manage");
  const canEnroll = me.permissions.has("enrollments.manage");
  const activeCourseIds = new Set(data.enrollments.filter((e) => e.status !== "CANCELLED").map((e) => e.course.id));
  const available = allCourses.filter((c) => !activeCourseIds.has(c.id));
  const validCerts = data.certificates.filter((c) => !c.revokedAt).length;

  // Série diária dos últimos 90 dias (zeros onde não houve estudo).
  const byDay = new Map(data.activity.map((a) => [isoDay(a.date), a]));
  const today = startOfUtcDay();
  const series = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(today.getTime() - (89 - i) * 86_400_000);
    const a = byDay.get(isoDay(d));
    return { label: formatDate(d, "dd/MM"), minutes: a ? Math.round(a.seconds / 60) : 0 };
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Alunos", href: "/admin/students" }, { label: user.name }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl} size="lg" />
            <span className="min-w-0">
              <span className="block truncate">{user.name}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-normal text-muted">
                {user.email}
                <Badge tone={USER_STATUS[user.status].tone} dot>{USER_STATUS[user.status].label}</Badge>
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/messages?to=${user.id}`}>
                <MessageSquare /> Mensagem
              </Link>
            </Button>
            {canEnroll && <EnrollDialogButton student={{ id: user.id, name: user.name }} courses={available} variant="outline" />}
            <ProfileActions
              user={{ id: user.id, name: user.name, email: user.email, phone: user.phone, headline: user.headline, status: user.status, roles: user.roles }}
              canManage={canManage}
              canGrantAdmin={me.permissions.has("roles.manage")}
              isSelf={user.id === me.id}
            />
          </>
        }
      />

      <StatStrip
        className="mb-8"
        items={[
          { label: "Cursos", value: formatNumber(stats.courses), hint: `${stats.completed} concluído(s)` },
          { label: "Progresso médio", value: `${stats.avgProgress}%`, hint: "nas matrículas ativas" },
          { label: "Tempo de estudo", value: formatDuration(stats.seconds), hint: stats.lastActivity ? `${formatNumber(stats.studyDays)} dias · último em ${formatShortDate(stats.lastActivity)}` : "ainda não estudou" },
          { label: "Nível", value: level.level, hint: `${formatNumber(user.xp)} XP · ${level.progress}% para o próximo` },
          { label: "Certificados", value: formatNumber(validCerts), hint: "válidos" },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Tabs defaultValue="courses" className="min-w-0">
          <TabsList>
            <TabsTrigger value="courses"><BookOpen className="size-4" /> Cursos</TabsTrigger>
            <TabsTrigger value="assignments"><ClipboardList className="size-4" /> Atividades</TabsTrigger>
            <TabsTrigger value="quizzes"><FileQuestion className="size-4" /> Avaliações</TabsTrigger>
            <TabsTrigger value="certificates"><Award className="size-4" /> Certificados</TabsTrigger>
            <TabsTrigger value="history"><History className="size-4" /> Histórico</TabsTrigger>
            <TabsTrigger value="achievements"><Trophy className="size-4" /> Conquistas</TabsTrigger>
          </TabsList>

          <TabsContent value="courses">
            {data.enrollments.length === 0 ? (
              <EmptyState icon={BookOpen} title="Sem matrículas" description="Este aluno ainda não está em nenhum curso." action={canEnroll ? <EnrollDialogButton student={{ id: user.id, name: user.name }} courses={available} /> : undefined} />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
                {data.enrollments.map((e) => (
                  <li key={e.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-fg">{e.course.title}</p>
                        <Badge tone={ENROLLMENT_STATUS[e.status].tone}>{ENROLLMENT_STATUS[e.status].label}</Badge>
                      </div>
                      <p className="mt-0.5 text-caption text-muted">
                        {e.course.instructor.name} · {SOURCE[e.source]} em {formatShortDate(e.enrolledAt)}
                        {e.completedAt ? ` · concluído em ${formatShortDate(e.completedAt)}` : e.lastAccessedAt ? ` · acesso ${timeAgo(e.lastAccessedAt)}` : " · ainda não acessou"}
                      </p>
                      {e.status !== "CANCELLED" && (
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={e.progressPercent} size="sm" tone={e.status === "COMPLETED" ? "success" : "primary"} className="w-28 shrink-0 sm:w-40" label={`Progresso em ${e.course.title}`} />
                          <span className="min-w-0 truncate text-caption tabular-nums text-muted">
                            {e.progressPercent}% de {e.course._count.lessons} aulas{e.lastLesson ? ` · parou em "${e.lastLesson.title}"` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    {canEnroll && e.status === "ACTIVE" && <RemoveEnrollmentButton enrollmentId={e.id} course={e.course.title} student={user.name} />}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="assignments">
            {data.submissions.length === 0 ? (
              <EmptyState compact icon={ClipboardList} title="Nenhuma entrega" description="As atividades enviadas pelo aluno aparecem aqui." />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
                {data.submissions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.assignment.title}</p>
                      <p className="truncate text-caption text-muted">{s.assignment.course.title} · enviada {timeAgo(s.submittedAt)}</p>
                    </div>
                    {s.score != null && <span className="text-sm font-medium tabular-nums">{formatNumber(s.score, 1)}/{s.assignment.maxScore}</span>}
                    <Badge tone={SUBMISSION_STATUS[s.status].tone}>{SUBMISSION_STATUS[s.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="quizzes">
            {data.attempts.length === 0 ? (
              <EmptyState compact icon={FileQuestion} title="Nenhuma tentativa" description="As tentativas de avaliações aparecem aqui." />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
                {data.attempts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.quiz.title}</p>
                      <p className="truncate text-caption text-muted">
                        {a.quiz.course.title} · tentativa {a.attemptNumber} · {a.submittedAt ? formatDateTime(a.submittedAt) : "em andamento"}
                      </p>
                    </div>
                    {a.score != null && <span className="text-sm font-medium tabular-nums">{Math.round(a.score)}%</span>}
                    {a.status === "IN_PROGRESS" ? (
                      <Badge>Em andamento</Badge>
                    ) : a.status === "PENDING_REVIEW" ? (
                      <Badge tone="warning">Aguardando correção</Badge>
                    ) : a.passed ? (
                      <Badge tone="success">Aprovado</Badge>
                    ) : (
                      <Badge tone="danger">Reprovado</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="certificates">
            {data.certificates.length === 0 ? (
              <EmptyState compact icon={Award} title="Nenhum certificado" description="Certificados são emitidos automaticamente ao concluir um curso." />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
                {data.certificates.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.courseTitle}</p>
                      <p className="truncate text-caption text-muted">
                        {c.workloadHours}h · emitido em {formatShortDate(c.issuedAt)} · código <span className="font-mono">{c.code}</span>
                      </p>
                    </div>
                    {c.revokedAt ? <Badge tone="danger">Revogado</Badge> : (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/certificate/${c.code}`} target="_blank">Validar</Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <ChartCard kind="column" title="Estudo nos últimos 90 dias" description="Minutos estudados por dia" data={series} series={[{ key: "minutes", label: "Minutos", slot: 1 }]} height={180} />
            <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
              <h3 className="border-b border-border px-4 py-3 text-h4 sm:px-5">Registro de eventos</h3>
              {data.logs.length === 0 ? (
                <p className="px-5 py-6 text-small text-subtle">Nenhum evento registrado.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.logs.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-2.5 sm:px-5">
                      <div className="min-w-0">
                        <p className="text-small text-fg">{auditLabel(l.action)}</p>
                        {l.actor && l.actor.id !== user.id && <p className="text-caption text-subtle">por {l.actor.name}</p>}
                      </div>
                      <span className="shrink-0 text-caption text-subtle" title={formatDateTime(l.createdAt)}>{timeAgo(l.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </TabsContent>

          <TabsContent value="achievements">
            <div className="mb-4 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">Nível {level.level}</p>
                <p className="text-caption text-muted tabular-nums">{formatNumber(user.xp)} / {formatNumber(level.nextAt)} XP</p>
              </div>
              <Progress value={level.progress} tone="accent" className="mt-2" label="Progresso para o próximo nível" />
            </div>
            {data.achievements.length === 0 ? (
              <EmptyState compact icon={Trophy} title="Nenhuma conquista ainda" description="Conquistas são liberadas ao concluir aulas, cursos e manter a sequência de estudos." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.achievements.map((a) => (
                  <li key={a.achievement.name} className="rounded-xl border border-border bg-surface p-4 shadow-xs">
                    <p className="text-sm font-medium">{a.achievement.name}</p>
                    <p className="mt-0.5 text-caption text-muted">{a.achievement.description}</p>
                    <p className="mt-2 text-caption text-subtle">+{a.achievement.xp} XP · {formatShortDate(a.awardedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <aside className="lg:pt-12">
          <section className="rounded-xl border border-border bg-surface px-4 py-2 shadow-xs sm:px-5">
            <h2 className="pt-2 pb-1 text-overline text-subtle">Informações</h2>
            <dl className="divide-y divide-border">
              <Info label="Perfis">{user.roles.map((r) => ROLE_LABELS[r]).join(", ")}</Info>
              <Info label="Telefone">{user.phone || "—"}</Info>
              <Info label="E-mail">{user.emailVerifiedAt ? "Confirmado" : <span className="text-warning">Não confirmado</span>}</Info>
              <Info label="Cadastro">{formatShortDate(user.createdAt)}</Info>
              <Info label="Último acesso">{timeAgo(user.lastSeenAt)}</Info>
              <Info label="Aulas concluídas">{formatNumber(stats.lessons)}</Info>
            </dl>
          </section>
          {user.bio && <p className="mt-4 px-1 text-small text-muted">{user.bio}</p>}
        </aside>
      </div>
    </>
  );
}
