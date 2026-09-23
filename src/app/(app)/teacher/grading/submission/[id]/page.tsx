import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getSubmissionForGrading, gradingQueue } from "@/server/services/grading";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GradeSubmissionForm } from "@/components/teacher/grade-forms";
import { SUBMISSION_STATUS } from "@/lib/labels";
import { formatBytes, formatDateTime, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Corrigir atividade" };

export default async function GradeSubmissionPage(props: PageProps<"/teacher/grading/submission/[id]">) {
  const user = await requirePermissionPage("grading.own", "courses.manage_any");
  const { id } = await props.params;
  let s;
  try {
    s = await getSubmissionForGrading(user, id);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) notFound();
    throw e;
  }
  const queue = await gradingQueue(user, { status: "pending" });
  const next = queue.find((q) => q.id !== s.id);
  const a = s.assignment;
  const st = SUBMISSION_STATUS[s.status];
  const late = !!a.dueAt && s.submittedAt > a.dueAt;
  const graded = s.status === "APPROVED" || s.status === "REJECTED" || s.status === "RETURNED";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Correções", href: "/teacher/grading" }, { label: a.course.title }, { label: s.user.name }]}
        title={a.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {late && <Badge tone="danger">Entregue após o prazo</Badge>}
            <span>{a.course.title}</span>
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-border bg-surface shadow-xs">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
              <Avatar name={s.user.name} src={s.user.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.user.name}</p>
                <p className="truncate text-caption text-subtle">
                  Enviado {timeAgo(s.submittedAt)} · {formatDateTime(s.submittedAt)}
                  {a.dueAt && ` · prazo ${formatDateTime(a.dueAt)}`}
                </p>
              </div>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <h2 className="mb-2 text-overline text-subtle">Resposta</h2>
              {s.textAnswer?.trim() ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{s.textAnswer}</div>
              ) : (
                <p className="text-small text-subtle">{s.file ? "O aluno enviou apenas o arquivo." : "Sem resposta em texto."}</p>
              )}
              {s.file && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted"><FileText className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.file.originalName}</p>
                    <p className="text-caption text-subtle">{formatBytes(s.file.sizeBytes)}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/files/${s.file.id}`} target="_blank" rel="noreferrer"><Download /> Abrir</a>
                  </Button>
                </div>
              )}
            </div>
          </section>
          {a.instructions.trim() && (
            <Accordion type="single" collapsible className="rounded-xl border border-border bg-surface px-4 shadow-xs sm:px-5">
              <AccordionItem value="instr">
                <AccordionTrigger>Instruções da atividade</AccordionTrigger>
                <AccordionContent>
                  <Markdown>{a.instructions}</Markdown>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {graded && s.gradedAt && (
            <p className="text-small text-muted">
              Corrigida por {s.gradedBy?.name ?? "—"} em {formatDateTime(s.gradedAt)}. Você pode revisar a correção abaixo.
            </p>
          )}
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
            <h2 className="mb-4 text-h4">{graded ? "Revisar correção" : "Sua correção"}</h2>
            <GradeSubmissionForm
              submissionId={s.id}
              maxScore={a.maxScore}
              passingScore={a.passingScore}
              nextHref={next ? next.href : "/teacher/grading"}
              initial={{ status: graded ? (s.status as "APPROVED" | "REJECTED" | "RETURNED") : null, score: s.score, feedback: s.feedback ?? "" }}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
