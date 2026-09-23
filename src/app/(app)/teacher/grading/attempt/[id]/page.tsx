import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/guards";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getAttemptForGrading, gradingQueue } from "@/server/services/grading";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GradeAttemptForm } from "@/components/teacher/grade-forms";
import { QUESTION_TYPE } from "@/lib/labels";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Corrigir questionário" };

export default async function GradeAttemptPage(props: PageProps<"/teacher/grading/attempt/[id]">) {
  const user = await requirePermissionPage("grading.own", "courses.manage_any");
  const { id } = await props.params;
  let a;
  try {
    a = await getAttemptForGrading(user, id);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) notFound();
    throw e;
  }
  const queue = await gradingQueue(user, { status: "pending" });
  const next = queue.find((q) => q.id !== a.id);
  const totalPoints = a.pointsTotal ?? a.answers.reduce((n, x) => n + x.question.points, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Correções", href: "/teacher/grading" }, { label: a.quiz.course.title }, { label: a.user.name }]}
        title={a.quiz.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {a.status === "PENDING_REVIEW" ? <Badge tone="info">Aguardando correção</Badge> : <Badge tone={a.passed ? "success" : "danger"}>{a.passed ? "Aprovado" : "Reprovado"} · {formatNumber(a.score ?? 0, 1)}%</Badge>}
            <span>Tentativa {a.attemptNumber}</span>
          </span>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={a.user.name} src={a.user.avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="truncate font-medium">{a.user.name}</p>
          <p className="text-caption text-subtle">Enviado {timeAgo(a.submittedAt)} · {formatDateTime(a.submittedAt)}</p>
        </div>
      </div>
      <GradeAttemptForm
        attemptId={a.id}
        passingScore={a.quiz.passingScore}
        totalPoints={totalPoints}
        nextHref={next ? next.href : "/teacher/grading"}
        answers={a.answers.map((x) => ({
          answerId: x.id,
          type: x.question.type,
          typeLabel: QUESTION_TYPE[x.question.type],
          prompt: x.question.prompt,
          points: x.question.points,
          pointsAwarded: x.pointsAwarded,
          isCorrect: x.isCorrect,
          feedback: x.feedback ?? "",
          textAnswer: x.textAnswer,
          acceptedAnswers: x.question.acceptedAnswers,
          options: x.question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, selected: x.selectedOptionIds.includes(o.id) })),
          manual: x.question.type === "ESSAY",
        }))}
      />
    </>
  );
}
