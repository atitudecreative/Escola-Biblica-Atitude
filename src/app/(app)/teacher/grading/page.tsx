import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, ClipboardList, ListChecks, Search } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { gradingCounts, gradingQueue, type QueueFilter } from "@/server/services/grading";
import { teacherCourseOptions } from "@/server/services/teacher";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableToolbar } from "@/components/data/table-toolbar";
import { buildHref, strParam } from "@/components/data/sort-header";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Correções" };

const STATUS_TABS: { value: NonNullable<QueueFilter["status"]>; label: string }[] = [
  { value: "pending", label: "Aguardando correção" },
  { value: "returned", label: "Devolvidas" },
  { value: "graded", label: "Corrigidas" },
  { value: "all", label: "Todas" },
];

export default async function GradingPage(props: PageProps<"/teacher/grading">) {
  const user = await requirePermissionPage("grading.own", "courses.manage_any");
  const sp = await props.searchParams;
  const statusParam = strParam(sp, "status");
  const status = STATUS_TABS.some((t) => t.value === statusParam) ? (statusParam as QueueFilter["status"]) : "pending";
  const kindParam = strParam(sp, "kind");
  const kind = kindParam === "quiz" || kindParam === "assignment" ? kindParam : undefined;
  const courseId = strParam(sp, "course") || undefined;
  const q = strParam(sp, "q")?.trim().toLowerCase();

  const [items, counts, courses] = await Promise.all([gradingQueue(user, { status, kind, courseId }), gradingCounts(user), teacherCourseOptions(user)]);
  const rows = q ? items.filter((i) => i.student.name.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)) : items;
  const countFor = (s: string) => (s === "pending" ? counts.pending : s === "returned" ? counts.returned : s === "graded" ? counts.graded : null);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ensino", href: "/teacher" }, { label: "Correções" }]}
        title="Correções"
        description="Entregas de atividades e questionários com respostas abertas. As mais antigas aparecem primeiro."
      />

      <div className="mb-4 flex flex-col gap-3">
        <nav aria-label="Filtrar por situação" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <ul className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
            {STATUS_TABS.map((t) => {
              const active = t.value === status;
              const n = countFor(t.value);
              return (
                <li key={t.value}>
                  <Link
                    href={buildHref(sp, { status: t.value === "pending" ? null : t.value })}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-small font-medium whitespace-nowrap transition-all", active ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg")}
                  >
                    {t.label}
                    {n != null && <span className={cn("tabular-nums", t.value === "pending" && n > 0 ? "text-warning" : "text-subtle")}>{formatNumber(n)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <TableToolbar
          placeholder="Buscar aluno ou atividade"
          filters={[
            { name: "course", label: "Todos os cursos", options: courses.map((c) => ({ value: c.id, label: c.title })) },
            { name: "kind", label: "Todos os tipos", options: [{ value: "assignment", label: "Atividades" }, { value: "quiz", label: "Questionários" }] },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        status === "pending" && !courseId && !kind && !q ? (
          <EmptyState icon={CheckCircle2} title="Nenhuma entrega aguardando correção" description="Quando um aluno enviar uma atividade ou responder uma questão aberta, ela aparece aqui." action={<Button variant="outline" asChild><Link href="/teacher/grading?status=graded">Ver corrigidas</Link></Button>} />
        ) : (
          <EmptyState icon={Search} compact title="Nada encontrado" description="Nenhum item corresponde aos filtros selecionados." action={<Button variant="outline" asChild><Link href="/teacher/grading">Limpar filtros</Link></Button>} />
        )
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
            <Table>
              <THead>
                <tr>
                  <TH>Aluno</TH>
                  <TH>Avaliação</TH>
                  <TH>Enviado</TH>
                  <TH>Situação</TH>
                  <TH className="text-right">Nota</TH>
                  <TH className="w-28"><span className="sr-only">Ação</span></TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={`${r.kind}-${r.id}`}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.student.name} src={r.student.avatarUrl} size="sm" />
                        <span className="truncate font-medium">{r.student.name}</span>
                      </div>
                    </TD>
                    <TD className="max-w-80">
                      <p className="flex items-center gap-1.5 truncate">
                        {r.kind === "quiz" ? <ListChecks className="size-3.5 shrink-0 text-subtle" aria-label="Questionário" /> : <ClipboardList className="size-3.5 shrink-0 text-subtle" aria-label="Atividade" />}
                        <span className="truncate">{r.title}</span>
                      </p>
                      <p className="truncate text-caption text-subtle">{r.course.title}</p>
                    </TD>
                    <TD className="text-small whitespace-nowrap text-muted" title={formatDateTime(r.submittedAt)}>
                      {timeAgo(r.submittedAt)}
                      {r.late && <Badge tone="danger" className="ml-2">Atrasada</Badge>}
                    </TD>
                    <TD><Badge tone={r.statusTone}>{r.statusLabel}</Badge></TD>
                    <TD className="text-right tabular-nums">{r.score != null ? (r.kind === "quiz" ? `${formatNumber(r.score, 1)}%` : formatNumber(r.score, 1)) : "—"}</TD>
                    <TD className="text-right">
                      <Button asChild size="sm" variant={status === "pending" ? "primary" : "outline"}>
                        <Link href={r.href}>{status === "pending" || r.status === "SUBMITTED" || r.status === "GRADING" || r.status === "PENDING_REVIEW" ? "Corrigir" : "Revisar"}</Link>
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link href={r.href} className="flex gap-3 rounded-xl border border-border bg-surface p-3 shadow-xs active:bg-surface-2">
                  <Avatar name={r.student.name} src={r.student.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">{r.student.name}</p>
                      <Badge tone={r.statusTone}>{r.statusLabel}</Badge>
                    </div>
                    <p className="truncate text-small">{r.title}</p>
                    <p className="truncate text-caption text-subtle">{r.course.title} · {timeAgo(r.submittedAt)}{r.late ? " · atrasada" : ""}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
