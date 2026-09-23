import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, ClipboardList, FileQuestion, GraduationCap, MessageSquare } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { getTeacherDetail } from "@/server/services/users-admin";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatStrip } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileActions } from "@/components/admin/people/user-actions";
import { COURSE_STATUS, ENROLLMENT_STATUS, SUBMISSION_STATUS, USER_STATUS } from "@/lib/labels";
import { formatNumber, formatShortDate, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Professor" };

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

export default async function TeacherDetailPage(props: PageProps<"/admin/teachers/[id]">) {
  const me = await requirePermissionPage("users.view", "students.view_all");
  const { id } = await props.params;
  const data = await getTeacherDetail(id);
  if (!data) notFound();
  const { user, metrics: m } = data;
  const canManage = me.permissions.has("users.manage");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Professores", href: "/admin/teachers" }, { label: user.name }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl} size="lg" />
            <span className="min-w-0">
              <span className="block truncate">{user.name}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-normal text-muted">
                {user.headline ?? user.email}
                <Badge tone={USER_STATUS[user.status].tone} dot>{USER_STATUS[user.status].label}</Badge>
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {user.id !== me.id && (
              <Button variant="outline" asChild>
                <Link href={`/messages?to=${user.id}`}>
                  <MessageSquare /> Mensagem
                </Link>
              </Button>
            )}
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
          { label: "Cursos", value: m.courses, hint: `${m.published} publicados` },
          { label: "Alunos", value: formatNumber(m.students), hint: `${formatNumber(m.completed)} concluíram` },
          { label: "Taxa de conclusão", value: pct(m.completionRate), hint: `progresso médio ${m.avgProgress}%` },
          { label: "Nota média", value: pct(m.avgQuizScore), hint: "avaliações corrigidas" },
          { label: "Correções pendentes", value: m.pending, hint: `${formatNumber(m.gradings)} já corrigidas` },
        ]}
      />

      {user.bio && <p className="mb-6 max-w-3xl text-sm text-muted">{user.bio}</p>}

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses"><BookOpen className="size-4" /> Cursos</TabsTrigger>
          <TabsTrigger value="students"><GraduationCap className="size-4" /> Alunos</TabsTrigger>
          <TabsTrigger value="assignments"><ClipboardList className="size-4" /> Atividades</TabsTrigger>
          <TabsTrigger value="quizzes"><FileQuestion className="size-4" /> Avaliações</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          {data.courses.length === 0 ? (
            <EmptyState compact icon={BookOpen} title="Nenhum curso" description="Os cursos criados por este professor aparecem aqui." />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
                <Table>
                  <THead>
                    <tr>
                      <TH>Curso</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Aulas</TH>
                      <TH className="text-right">Alunos</TH>
                      <TH className="w-44">Progresso médio</TH>
                      <TH className="text-right">Conclusão</TH>
                      <TH className="text-right">Nota média</TH>
                      <TH className="text-right">Avaliação</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {data.courses.map((c) => (
                      <TR key={c.id}>
                        <TD className="max-w-[18rem] truncate font-medium">{c.title}</TD>
                        <TD><Badge tone={COURSE_STATUS[c.status].tone}>{COURSE_STATUS[c.status].label}</Badge></TD>
                        <TD className="text-right tabular-nums">{c._count.lessons}</TD>
                        <TD className="text-right tabular-nums">{c.students}</TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <Progress value={c.avgProgress} size="sm" className="w-20" label={`Progresso médio em ${c.title}`} />
                            <span className="text-small tabular-nums">{c.avgProgress}%</span>
                          </div>
                        </TD>
                        <TD className="text-right tabular-nums">{c.students ? pct((c.completed / c.students) * 100) : "—"}</TD>
                        <TD className="text-right tabular-nums">{pct(c.avgQuiz)}</TD>
                        <TD className="text-right tabular-nums">{c.ratingCount ? `${formatNumber(c.ratingAvg, 1)} (${c.ratingCount})` : "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:hidden">
                {data.courses.map((c) => (
                  <li key={c.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-medium">{c.title}</p>
                      <Badge tone={COURSE_STATUS[c.status].tone}>{COURSE_STATUS[c.status].label}</Badge>
                    </div>
                    <p className="mt-1 text-caption text-muted">
                      {c.students} alunos · {c.students ? pct((c.completed / c.students) * 100) : "—"} de conclusão · nota {pct(c.avgQuiz)}
                    </p>
                    <Progress value={c.avgProgress} size="sm" className="mt-2" label={`Progresso médio em ${c.title}`} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        <TabsContent value="students">
          {data.students.length === 0 ? (
            <EmptyState compact icon={GraduationCap} title="Nenhum aluno ainda" description="Matrículas nos cursos deste professor aparecem aqui." />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
              {data.students.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={e.user.name} src={e.user.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/students/${e.user.id}`} className="block truncate text-sm font-medium hover:underline">{e.user.name}</Link>
                    <p className="truncate text-caption text-muted">{e.course.title} · desde {formatShortDate(e.enrolledAt)}</p>
                  </div>
                  <div className="hidden w-32 items-center gap-2 sm:flex">
                    <Progress value={e.progressPercent} size="sm" label={`Progresso de ${e.user.name}`} />
                    <span className="text-caption tabular-nums">{e.progressPercent}%</span>
                  </div>
                  <Badge tone={ENROLLMENT_STATUS[e.status].tone}>{ENROLLMENT_STATUS[e.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="assignments">
          {data.submissions.length === 0 ? (
            <EmptyState compact icon={ClipboardList} title="Nenhuma entrega" description="Entregas das atividades dos cursos deste professor aparecem aqui." />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
              {data.submissions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.assignment.title}</p>
                    <p className="truncate text-caption text-muted">
                      {s.user.name} · {s.assignment.course.title} · {timeAgo(s.submittedAt)}
                    </p>
                  </div>
                  {s.score != null && <span className="text-sm tabular-nums">{formatNumber(s.score, 1)}/{s.assignment.maxScore}</span>}
                  <Badge tone={SUBMISSION_STATUS[s.status].tone}>{SUBMISSION_STATUS[s.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="quizzes">
          {data.attempts.length === 0 ? (
            <EmptyState compact icon={FileQuestion} title="Nenhuma tentativa" description="Tentativas das avaliações dos cursos deste professor aparecem aqui." />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
              {data.attempts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.quiz.title}</p>
                    <p className="truncate text-caption text-muted">
                      {a.user.name} · {a.quiz.course.title} · {timeAgo(a.submittedAt ?? a.startedAt)}
                    </p>
                  </div>
                  {a.score != null && <span className="text-sm tabular-nums">{Math.round(a.score)}%</span>}
                  {a.status === "PENDING_REVIEW" ? <Badge tone="warning">Aguardando correção</Badge> : a.passed ? <Badge tone="success">Aprovado</Badge> : <Badge tone="danger">Reprovado</Badge>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
