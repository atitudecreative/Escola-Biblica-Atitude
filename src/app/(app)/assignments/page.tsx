import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { studentAssignments } from "@/server/services/assessments";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUBMISSION_STATUS } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Atividades" };

export default async function AssignmentsPage() {
  const user = await requireUserPage();
  const items = await studentAssignments(user.id);
  const pending = items.filter((a) => !a.submission || a.submission.status === "RETURNED");
  const done = items.filter((a) => a.submission && a.submission.status !== "RETURNED");
  const now = new Date();

  const Row = ({ a }: { a: (typeof items)[number] }) => {
    const status = a.submission?.status ?? "PENDING";
    const late = !a.submission && a.dueAt && a.dueAt < now;
    return (
      <li>
        <Link href={a.lesson ? `/learn/${a.courseId}/${a.lesson.id}` : `/courses/${a.course.slug}`} className="flex flex-col gap-2 px-4 py-3.5 transition hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{a.title}</p>
            <p className="truncate text-caption text-subtle">{a.course.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {a.dueAt && <Badge tone={late ? "danger" : "neutral"}>{late ? "Atrasada · " : "Prazo "}{formatDate(a.dueAt, "dd/MM")}</Badge>}
            {a.submission?.score != null && <span className="text-small font-medium tabular-nums">{formatNumber(a.submission.score, 1)}/{a.maxScore}</span>}
            <Badge tone={SUBMISSION_STATUS[status].tone} dot>{SUBMISSION_STATUS[status].label}</Badge>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Atividades" description="Entregas dos seus cursos: pendentes, enviadas e corrigidas." />
      {items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhuma atividade por enquanto" description="As atividades dos cursos em que você está matriculado aparecem aqui." action={<Button asChild variant="outline"><Link href="/my-courses">Meus cursos</Link></Button>} />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-h4">Para fazer <span className="text-subtle">({pending.length})</span></h2>
            {pending.length ? (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">{pending.map((a) => <Row key={a.id} a={a} />)}</ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-small text-muted">Tudo entregue. Muito bem!</p>
            )}
          </section>
          {done.length > 0 && (
            <section>
              <h2 className="mb-3 text-h4">Enviadas e corrigidas <span className="text-subtle">({done.length})</span></h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">{done.map((a) => <Row key={a.id} a={a} />)}</ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
