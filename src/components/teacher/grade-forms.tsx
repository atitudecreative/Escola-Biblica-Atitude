"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CornerUpLeft, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useAction } from "@/hooks/use-action";
import { gradeAttemptAction, gradeSubmissionAction } from "@/app/(app)/teacher/grading/actions";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Decision = "APPROVED" | "REJECTED" | "RETURNED";

const DECISIONS: { value: Decision; label: string; hint: string; icon: typeof CheckCircle2; tone: string }[] = [
  { value: "APPROVED", label: "Aprovar", hint: "Conclui a aula para o aluno", icon: CheckCircle2, tone: "border-success bg-success-soft text-success" },
  { value: "RETURNED", label: "Devolver para ajustes", hint: "O aluno pode reenviar", icon: CornerUpLeft, tone: "border-warning bg-warning-soft text-warning" },
  { value: "REJECTED", label: "Reprovar", hint: "Nota abaixo do mínimo", icon: XCircle, tone: "border-danger bg-danger-soft text-danger" },
];

export function GradeSubmissionForm({
  submissionId,
  maxScore,
  passingScore,
  initial,
  nextHref,
}: {
  submissionId: string;
  maxScore: number;
  passingScore: number;
  initial: { status: Decision | null; score: number | null; feedback: string };
  nextHref: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Decision | null>(initial.status);
  const [score, setScore] = useState(initial.score != null ? String(initial.score).replace(".", ",") : "");
  const [feedback, setFeedback] = useState(initial.feedback);
  const { run, pending, error, fieldErrors } = useAction(gradeSubmissionAction);
  const numeric = score.trim() === "" ? null : Number(score.replace(",", "."));
  const suggestion = numeric != null && Number.isFinite(numeric) ? (numeric >= passingScore ? "APPROVED" : "REJECTED") : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ submissionId, status: status ?? suggestion, score: numeric, feedback });
    if (res?.ok && nextHref) setTimeout(() => router.push(nextHref), 0);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
      <Field label={`Nota (0 a ${maxScore})`} hint={`Mínimo para aprovação: ${formatNumber(passingScore)}`} error={fieldErrors.score}>
        <Input inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Ex.: 8,5" className="text-base font-semibold sm:max-w-40" />
      </Field>
      <fieldset>
        <legend className="mb-2 text-small font-medium">Resultado</legend>
        <div className="flex flex-col gap-2">
          {DECISIONS.map((d) => {
            const selected = (status ?? suggestion) === d.value;
            return (
              <label
                key={d.value}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                  selected ? d.tone : "border-border hover:bg-surface-2",
                )}
              >
                <input type="radio" name="decision" value={d.value} checked={selected} onChange={() => setStatus(d.value)} className="sr-only" />
                <d.icon className="size-4 shrink-0" />
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", !selected && "text-fg")}>{d.label}</span>
                  <span className={cn("block text-caption", selected ? "opacity-80" : "text-subtle")}>{d.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        {fieldErrors.status && <p role="alert" className="mt-1.5 text-caption font-medium text-danger">{fieldErrors.status}</p>}
      </fieldset>
      <Field label="Comentário para o aluno" hint={(status ?? suggestion) === "RETURNED" ? "Obrigatório ao devolver: explique o que ajustar." : "Opcional, mas faz diferença."} error={fieldErrors.feedback}>
        <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={6} maxLength={5000} placeholder="O que ficou bom, o que pode melhorar…" />
      </Field>
      <Button type="submit" loading={pending} disabled={!(status ?? suggestion)} className="w-full">
        {nextHref ? "Salvar e ir para a próxima" : "Salvar correção"}
      </Button>
      <p className="text-caption text-subtle">O aluno recebe uma notificação e um e-mail com o resultado.</p>
    </form>
  );
}

export type AttemptAnswerRow = {
  answerId: string;
  type: string;
  typeLabel: string;
  prompt: string;
  points: number;
  pointsAwarded: number | null;
  isCorrect: boolean | null;
  feedback: string;
  textAnswer: string | null;
  options: { text: string; isCorrect: boolean; selected: boolean }[];
  acceptedAnswers: string[];
  manual: boolean; // questão aberta: exige correção do professor
};

/** Correção de tentativa com questões abertas: pontos + comentário por resposta. */
export function GradeAttemptForm({
  attemptId,
  answers,
  passingScore,
  totalPoints,
  nextHref,
}: {
  attemptId: string;
  answers: AttemptAnswerRow[];
  passingScore: number;
  totalPoints: number;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [grades, setGrades] = useState<Record<string, { points: string; feedback: string }>>(() =>
    Object.fromEntries(answers.filter((a) => a.manual).map((a) => [a.answerId, { points: a.pointsAwarded != null ? String(a.pointsAwarded) : "", feedback: a.feedback }])),
  );
  const { run, pending, error } = useAction(gradeAttemptAction);
  const manual = answers.filter((a) => a.manual);
  const autoPoints = answers.filter((a) => !a.manual).reduce((n, a) => n + (a.pointsAwarded ?? 0), 0);
  const num = (v: string | undefined) => Number((v ?? "").replace(",", ".")) || 0;
  const earned = autoPoints + manual.reduce((n, a) => n + num(grades[a.answerId]?.points), 0);
  const score = totalPoints ? Math.round((earned / totalPoints) * 1000) / 10 : 0;
  const missing = manual.filter((a) => (grades[a.answerId]?.points ?? "").trim() === "").length;
  const over = manual.find((a) => num(grades[a.answerId]?.points) > a.points);

  async function submit() {
    const res = await run({
      attemptId,
      answers: manual.map((a) => ({ answerId: a.answerId, pointsAwarded: num(grades[a.answerId].points), feedback: grades[a.answerId].feedback })),
    });
    if (res?.ok && nextHref) setTimeout(() => router.push(nextHref), 0);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <ol className="flex min-w-0 flex-col gap-3">
        {answers.map((a, i) => (
          <li key={a.answerId} className={cn("rounded-xl border bg-surface p-4 shadow-xs sm:p-5", a.manual ? "border-primary/30" : "border-border")}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-overline text-subtle">Questão {i + 1} · {a.typeLabel}</span>
              {a.manual ? (
                <span className="text-caption font-medium text-primary">Correção manual · até {formatNumber(a.points)} pt</span>
              ) : (
                <span className={cn("inline-flex items-center gap-1 text-caption font-medium", a.isCorrect ? "text-success" : "text-danger")}>
                  {a.isCorrect ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {formatNumber(a.pointsAwarded ?? 0, 1)} / {formatNumber(a.points)} pt
                </span>
              )}
            </div>
            <p className="text-sm font-medium whitespace-pre-line">{a.prompt}</p>

            {a.options.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {a.options.map((o, k) => (
                  <li key={k} className={cn("flex items-start gap-2 rounded-md px-2.5 py-1.5 text-small", o.selected && (o.isCorrect ? "bg-success-soft text-success" : "bg-danger-soft text-danger"), !o.selected && o.isCorrect && "text-success", !o.selected && !o.isCorrect && "text-muted")}>
                    <span className="mt-0.5 w-20 shrink-0 text-caption font-medium">{o.selected ? "Marcou" : o.isCorrect ? "Correta" : ""}</span>
                    <span>{o.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {(a.type === "SHORT_ANSWER" || a.type === "ESSAY") && (
              <div className="mt-3 rounded-lg bg-surface-2/70 px-3 py-2.5">
                <p className="mb-1 text-caption text-subtle">Resposta do aluno</p>
                <p className="text-sm whitespace-pre-wrap">{a.textAnswer?.trim() || <span className="text-subtle">Sem resposta</span>}</p>
                {a.type === "SHORT_ANSWER" && a.acceptedAnswers.length > 0 && <p className="mt-2 text-caption text-subtle">Aceitas: {a.acceptedAnswers.join(" · ")}</p>}
              </div>
            )}

            {a.manual && (
              <div className="mt-4 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                <Field label="Pontos" error={num(grades[a.answerId]?.points) > a.points ? `Máximo ${a.points}` : undefined}>
                  <Input
                    inputMode="decimal"
                    value={grades[a.answerId]?.points ?? ""}
                    onChange={(e) => setGrades((g) => ({ ...g, [a.answerId]: { ...g[a.answerId], points: e.target.value.replace(/[^\d.,]/g, "") } }))}
                    placeholder={`0 a ${a.points}`}
                  />
                </Field>
                <Field label="Comentário">
                  <Textarea
                    value={grades[a.answerId]?.feedback ?? ""}
                    onChange={(e) => setGrades((g) => ({ ...g, [a.answerId]: { ...g[a.answerId], feedback: e.target.value } }))}
                    rows={2}
                    maxLength={2000}
                    className="min-h-10"
                    placeholder="Opcional"
                  />
                </Field>
              </div>
            )}
          </li>
        ))}
      </ol>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs">
          <h2 className="text-h4">Resultado</h2>
          {error && <Alert tone="danger">{error}</Alert>}
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-2/70 p-3">
              <dt className="text-caption text-subtle">Pontos</dt>
              <dd className="text-h3 tabular-nums">
                {formatNumber(earned, 1)}
                <span className="text-small font-normal text-subtle"> / {formatNumber(totalPoints)}</span>
              </dd>
            </div>
            <div className="rounded-lg bg-surface-2/70 p-3">
              <dt className="text-caption text-subtle">Nota</dt>
              <dd className={cn("text-h3 tabular-nums", score >= passingScore ? "text-success" : "text-danger")}>{formatNumber(score, 1)}%</dd>
            </div>
          </dl>
          <p className="text-small text-muted">
            Nota mínima: {passingScore}%.{" "}
            {missing ? `Falta corrigir ${missing} resposta(s).` : score >= passingScore ? "Com esta correção o aluno será aprovado." : "Com esta correção o aluno fica abaixo da nota mínima."}
          </p>
          <Button onClick={submit} loading={pending} disabled={missing > 0 || !!over} className="w-full">
            {nextHref ? "Salvar e ir para a próxima" : "Concluir correção"}
          </Button>
          <p className="text-caption text-subtle">O aluno recebe uma notificação com a nota final.</p>
        </div>
      </aside>
    </div>
  );
}
