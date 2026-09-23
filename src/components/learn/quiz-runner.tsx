"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, CheckCircle2, CircleDashed, Clock, ListChecks, RotateCcw, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, RadioGroup, RadioItem } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm";
import { saveQuizAction, startQuizAction, submitQuizAction } from "@/app/learn/actions";
import { formatClock, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { quizStateFor } from "@/server/services/assessments";

type State = Awaited<ReturnType<typeof quizStateFor>>;
type Answers = Record<string, { selected?: string[]; text?: string }>;

export function QuizRunner({ state, enrolled }: { state: State; enrolled: boolean }) {
  if (state.current) return <QuizAttempt state={state} />;
  return <QuizIntro state={state} enrolled={enrolled} />;
}

function QuizIntro({ state, enrolled }: { state: State; enrolled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { quiz, attempts, remaining, passed, bestScore, review } = state;
  const last = attempts[0];
  const awaitingReview = last?.status === "PENDING_REVIEW";
  const canStart = enrolled && remaining !== 0 && quiz.questionCount > 0 && !awaitingReview;

  async function start() {
    setPending(true);
    const res = await startQuizAction(quiz.id);
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><ListChecks className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="text-h2">{quiz.title}</h2>
            {quiz.description && <p className="mt-1 text-sm text-muted">{quiz.description}</p>}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
          <Fact label="Questões" value={quiz.questionCount} />
          <Fact label="Nota mínima" value={`${quiz.passingScore}%`} />
          <Fact label="Tempo" value={quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "Livre"} />
          <Fact label="Tentativas" value={quiz.maxAttempts ? `${remaining ?? 0} de ${quiz.maxAttempts} restantes` : "Ilimitadas"} />
        </dl>
      </div>

      {last && (
        <ResultBanner status={last.status} score={last.score} passed={last.passed} passingScore={quiz.passingScore} bestScore={bestScore} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canStart && !passed && (
          <Button size="lg" loading={pending} onClick={start}>
            {last ? <><RotateCcw /> Tentar novamente</> : "Começar avaliação"}
          </Button>
        )}
        {canStart && passed && (
          <Button variant="outline" loading={pending} onClick={start}>
            <RotateCcw /> Refazer para melhorar a nota
          </Button>
        )}
        {!enrolled && <Alert tone="info">Matricule-se no curso para fazer esta avaliação.</Alert>}
        {enrolled && remaining === 0 && !passed && <Alert tone="warning">Você usou todas as tentativas. Fale com o professor pela aba Dúvidas.</Alert>}
        {!!quiz.timeLimitMinutes && canStart && (
          <p className="flex items-center gap-1.5 text-small text-muted"><AlarmClock className="size-4" /> O cronômetro começa quando você iniciar.</p>
        )}
      </div>

      {review && (
        <section aria-label="Correção da última tentativa" className="space-y-3">
          <h3 className="text-h3">Correção da última tentativa</h3>
          {review.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium"><span className="mr-2 text-subtle">{i + 1}.</span>{q.prompt}</p>
                {q.isCorrect === null ? (
                  <Badge tone="warning"><CircleDashed /> Aguardando correção</Badge>
                ) : q.isCorrect ? (
                  <Badge tone="success"><CheckCircle2 /> Correta</Badge>
                ) : (
                  <Badge tone="danger"><XCircle /> Incorreta</Badge>
                )}
              </div>
              {q.options.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {q.options.map((o) => (
                    <li key={o.id} className={cn("flex items-center gap-2 rounded-md px-2.5 py-1.5 text-small", o.isCorrect ? "bg-success-soft text-fg" : o.selected ? "bg-danger-soft text-fg" : "text-muted")}>
                      {o.isCorrect ? <CheckCircle2 className="size-4 text-success" /> : o.selected ? <XCircle className="size-4 text-danger" /> : <span className="size-4" />}
                      {o.text}
                      {o.selected && <span className="ml-auto text-caption text-subtle">sua resposta</span>}
                    </li>
                  ))}
                </ul>
              )}
              {q.textAnswer && <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-small">Sua resposta: {q.textAnswer}</p>}
              {q.type === "SHORT_ANSWER" && !q.isCorrect && q.acceptedAnswers.length > 0 && (
                <p className="mt-2 text-caption text-muted">Resposta esperada: {q.acceptedAnswers[0]}</p>
              )}
              {q.feedback && <p className="mt-2 text-small text-info">Professor: {q.feedback}</p>}
              {q.explanation && <p className="mt-2 text-caption text-subtle">{q.explanation}</p>}
            </div>
          ))}
        </section>
      )}

      {attempts.length > 0 && (
        <section>
          <h3 className="mb-2 text-h4">Histórico</h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-small">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>Tentativa {a.attemptNumber} <span className="text-subtle">· {formatDateTime(a.submittedAt)}</span></span>
                <span className="font-medium tabular-nums">
                  {a.status === "PENDING_REVIEW" ? "Em correção" : `${formatNumber(a.score ?? 0, 1)}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function ResultBanner({ status, score, passed, passingScore, bestScore }: { status: string; score: number | null; passed: boolean | null; passingScore: number; bestScore: number | null }) {
  if (status === "PENDING_REVIEW")
    return <Alert tone="info" title="Enviada para correção">Sua avaliação tem questões abertas e será corrigida pelo professor. Você será notificado.</Alert>;
  return passed ? (
    <div className="flex items-center gap-4 rounded-xl border border-success/25 bg-success-soft p-5">
      <Trophy className="size-8 shrink-0 text-success" />
      <div>
        <p className="text-h3">Aprovado com {formatNumber(score ?? 0, 1)}%</p>
        <p className="text-small text-muted">Nota mínima {passingScore}%{bestScore != null && bestScore !== score ? ` · melhor nota ${formatNumber(bestScore, 1)}%` : ""}</p>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-4 rounded-xl border border-warning/25 bg-warning-soft p-5">
      <XCircle className="size-8 shrink-0 text-warning" />
      <div>
        <p className="text-h3">Você fez {formatNumber(score ?? 0, 1)}%</p>
        <p className="text-small text-muted">A nota mínima é {passingScore}%. Revise o conteúdo e tente de novo.</p>
      </div>
    </div>
  );
}

function QuizAttempt({ state }: { state: State }) {
  const router = useRouter();
  const confirm = useConfirm();
  const current = state.current!;
  const [answers, setAnswers] = useState<Answers>(current.saved);
  const [submitting, setSubmitting] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const dirty = useRef(false);
  const submitted = useRef(false);

  const answeredCount = useMemo(
    () => current.questions.filter((q) => (answers[q.id]?.selected?.length ?? 0) > 0 || (answers[q.id]?.text ?? "").trim()).length,
    [answers, current.questions],
  );

  // Autosave a cada 10s quando houver mudanças.
  useEffect(() => {
    const t = setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      void saveQuizAction({ attemptId: current.id, answers });
    }, 10_000);
    return () => clearInterval(t);
  }, [answers, current.id]);

  async function submit(auto = false) {
    if (submitted.current) return;
    if (!auto) {
      const missing = current.questions.length - answeredCount;
      const ok = await confirm({
        title: "Enviar avaliação?",
        description: missing ? `Você deixou ${missing} questão(ões) sem resposta. Depois de enviar não é possível alterar.` : "Depois de enviar não é possível alterar suas respostas.",
        confirmLabel: "Enviar respostas",
        tone: "primary",
      });
      if (!ok) return;
    }
    submitted.current = true;
    setSubmitting(true);
    const res = await submitQuizAction({ attemptId: current.id, answers });
    setSubmitting(false);
    if (!res.ok) {
      submitted.current = false;
      toast.error(res.error);
      return;
    }
    if (auto) toast.info("Tempo esgotado — suas respostas foram enviadas.");
    router.refresh();
  }

  // Cronômetro
  useEffect(() => {
    if (!current.expiresAt) return;
    const end = new Date(current.expiresAt).getTime();
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) void submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.expiresAt]);

  const set = (qid: string, v: { selected?: string[]; text?: string }) => {
    dirty.current = true;
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], ...v } }));
  };

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-5 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{state.quiz.title}</p>
          <p className="text-caption text-subtle">Tentativa {current.attemptNumber} · {answeredCount} de {current.questions.length} respondidas</p>
        </div>
        {left != null && (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-small font-semibold tabular-nums", left < 60 ? "bg-danger-soft text-danger" : "bg-surface-2 text-fg")} role="timer" aria-live={left < 60 ? "assertive" : "off"}>
            <Clock className="size-4" /> {formatClock(left)}
          </span>
        )}
        <Button onClick={() => submit()} loading={submitting}>Enviar</Button>
      </div>

      <ol className="space-y-4">
        {current.questions.map((q, i) => {
          const a = answers[q.id] ?? {};
          const name = `q-${q.id}`;
          return (
            <li key={q.id} className="rounded-xl border border-border bg-surface p-5">
              <fieldset>
                <legend className="text-[0.9375rem] font-medium">
                  <span className="mr-2 text-subtle">{i + 1}.</span>
                  {q.prompt}
                  <span className="ml-2 text-caption font-normal text-subtle">({q.points} {q.points === 1 ? "ponto" : "pontos"})</span>
                </legend>
                <div className="mt-4">
                  {(q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") && (
                    <RadioGroup value={a.selected?.[0] ?? ""} onValueChange={(v) => set(q.id, { selected: [v] })} className="space-y-2" aria-label={`Questão ${i + 1}`}>
                      {q.options.map((o) => (
                        <label key={o.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors", a.selected?.[0] === o.id ? "border-primary bg-primary-soft/50" : "border-border hover:border-border-strong")}>
                          <RadioItem value={o.id} id={`${name}-${o.id}`} />
                          {o.text}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                  {q.type === "MULTIPLE_CHOICE" && (
                    <div className="space-y-2">
                      <p className="text-caption text-subtle">Marque todas as corretas.</p>
                      {q.options.map((o) => {
                        const on = a.selected?.includes(o.id) ?? false;
                        return (
                          <label key={o.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors", on ? "border-primary bg-primary-soft/50" : "border-border hover:border-border-strong")}>
                            <Checkbox
                              checked={on}
                              onCheckedChange={(v) => set(q.id, { selected: v ? [...(a.selected ?? []), o.id] : (a.selected ?? []).filter((x) => x !== o.id) })}
                            />
                            {o.text}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "SHORT_ANSWER" && (
                    <Input value={a.text ?? ""} onChange={(e) => set(q.id, { text: e.target.value })} placeholder="Sua resposta" maxLength={200} aria-label={`Resposta da questão ${i + 1}`} />
                  )}
                  {q.type === "ESSAY" && (
                    <Textarea value={a.text ?? ""} onChange={(e) => set(q.id, { text: e.target.value })} placeholder="Escreva sua resposta" className="min-h-32" maxLength={5000} aria-label={`Resposta da questão ${i + 1}`} />
                  )}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={() => submit()} loading={submitting}>Enviar respostas</Button>
      </div>
    </div>
  );
}
