"use client";
import { useState } from "react";
import type { FeedbackMode, QuestionType } from "@prisma/client";
import { ArrowDown, ArrowUp, Check, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { useAction } from "@/hooks/use-action";
import { deleteQuestionAction, moveQuestionAction, saveQuestionAction, updateQuizSettingsAction } from "@/app/(app)/teacher/courses/[id]/actions";
import { QUESTION_TYPE } from "@/lib/labels";
import { QUESTION_TYPES } from "@/lib/validation/teacher";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ListEditor } from "./form-helpers";

export type QuizSettings = {
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  timeLimitMinutes: number | null;
  feedbackMode: FeedbackMode;
  requiredToComplete: boolean;
};
export type QuizQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  acceptedAnswers: string[];
  options: { text: string; isCorrect: boolean }[];
};

const FEEDBACK: Record<FeedbackMode, string> = {
  AFTER_SUBMIT: "Logo após enviar",
  AFTER_PASS: "Somente após ser aprovado",
  NEVER: "Nunca mostrar respostas",
};

export function QuizEditor({ lessonId, settings, questions, attempts }: { lessonId: string; settings: QuizSettings; questions: QuizQuestion[]; attempts: number }) {
  const [editing, setEditing] = useState<QuizQuestion | "new" | null>(null);
  const confirm = useConfirm();
  const del = useAction(deleteQuestionAction, { errorToast: true });
  const move = useAction(moveQuestionAction, { errorToast: true });
  const total = questions.reduce((n, q) => n + q.points, 0);
  const hasEssay = questions.some((q) => q.type === "ESSAY");

  return (
    <div className="flex flex-col gap-6">
      <QuizSettingsForm lessonId={lessonId} initial={settings} />

      <section className="rounded-xl border border-border bg-surface shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
          <div>
            <h3 className="text-h4">Questões</h3>
            <p className="text-small text-muted">
              {pluralize(questions.length, "questão", "questões")} · {pluralize(total, "ponto", "pontos")} no total
            </p>
          </div>
          <Button type="button" onClick={() => setEditing("new")}><Plus /> Nova questão</Button>
        </div>
        {attempts > 0 && (
          <div className="px-4 pb-3 sm:px-5">
            <Alert tone="info">Este questionário já tem {pluralize(attempts, "tentativa", "tentativas")}. Alterações valem para as próximas; notas já registradas não mudam.</Alert>
          </div>
        )}
        {hasEssay && (
          <div className="px-4 pb-3 sm:px-5">
            <Alert tone="info">Há questões abertas: as tentativas ficam aguardando sua correção em Correções antes de gerar a nota final.</Alert>
          </div>
        )}
        {questions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border px-6 py-10 text-center">
            <ListChecks className="size-6 text-subtle" aria-hidden />
            <p className="text-sm font-medium">Nenhuma questão ainda</p>
            <p className="max-w-sm text-small text-muted">Combine múltipla escolha, verdadeiro ou falso, resposta curta e questões abertas.</p>
            <Button type="button" variant="outline" onClick={() => setEditing("new")}><Plus /> Adicionar a primeira questão</Button>
          </div>
        ) : (
          <ol className="divide-y divide-border border-t border-border">
            {questions.map((q, i) => (
              <li key={q.id} className="flex gap-3 px-4 py-4 sm:px-5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-semibold tabular-nums text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{QUESTION_TYPE[q.type]}</Badge>
                    <span className="text-caption text-subtle">{pluralize(q.points, "ponto", "pontos")}</span>
                  </div>
                  <p className="mt-1.5 text-sm whitespace-pre-line text-fg">{q.prompt}</p>
                  {q.options.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {q.options.map((o, k) => (
                        <li key={k} className={cn("flex items-start gap-2 text-small", o.isCorrect ? "text-success" : "text-muted")}>
                          {o.isCorrect ? <Check className="mt-0.5 size-3.5 shrink-0" aria-label="Correta" /> : <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden />}
                          <span>{o.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.type === "SHORT_ANSWER" && <p className="mt-2 text-small text-muted">Aceitas: {q.acceptedAnswers.join(" · ")}</p>}
                  {q.type === "ESSAY" && <p className="mt-2 text-small text-muted">Correção manual pelo professor.</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row sm:items-start">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar questão ${i + 1}`} onClick={() => setEditing(q)}><Pencil /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mover questão ${i + 1} para cima`} disabled={i === 0 || move.pending} onClick={() => move.run({ id: q.id, direction: "up" })}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mover questão ${i + 1} para baixo`} disabled={i === questions.length - 1 || move.pending} onClick={() => move.run({ id: q.id, direction: "down" })}><ArrowDown /></Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Excluir questão ${i + 1}`}
                    disabled={del.pending}
                    onClick={async () => {
                      if (await confirm({ title: `Excluir a questão ${i + 1}?`, description: "As respostas já dadas a ela também serão removidas.", confirmLabel: "Excluir questão" })) del.run({ id: q.id });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <QuestionDialog lessonId={lessonId} value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function QuizSettingsForm({ lessonId, initial }: { lessonId: string; initial: QuizSettings }) {
  const [v, setV] = useState(initial);
  const [base, setBase] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setV(initial);
    setBase(initial);
  }
  const { run, pending, fieldErrors } = useAction(updateQuizSettingsAction, { errorToast: true });
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  const set = <K extends keyof QuizSettings>(k: K, val: QuizSettings[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run({ lessonId, ...v });
        if (r?.ok) setBase(v);
      }}
      noValidate
      className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5"
    >
      <h3 className="mb-4 text-h4">Regras do questionário</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nota mínima (%)" error={fieldErrors.passingScore}>
          <Input type="number" min={0} max={100} value={v.passingScore} onChange={(e) => set("passingScore", Number(e.target.value))} />
        </Field>
        <Field label="Tentativas" hint="0 = ilimitadas" error={fieldErrors.maxAttempts}>
          <Input type="number" min={0} max={50} value={v.maxAttempts} onChange={(e) => set("maxAttempts", Number(e.target.value))} />
        </Field>
        <Field label="Tempo limite (min)" hint="Vazio = sem limite" error={fieldErrors.timeLimitMinutes}>
          <Input type="number" min={0} max={600} value={v.timeLimitMinutes ?? ""} onChange={(e) => set("timeLimitMinutes", e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label="Mostrar respostas corretas" error={fieldErrors.feedbackMode}>
          <NativeSelect value={v.feedbackMode} onChange={(e) => set("feedbackMode", e.target.value as FeedbackMode)}>
            {(Object.keys(FEEDBACK) as FeedbackMode[]).map((k) => (
              <option key={k} value={k}>{FEEDBACK[k]}</option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-start justify-between gap-4 rounded-lg bg-surface-2/60 px-3 py-3">
          <span>
            <span className="block text-sm font-medium">Embaralhar questões</span>
            <span className="block text-small text-muted">Cada tentativa recebe uma ordem diferente.</span>
          </span>
          <Switch checked={v.shuffleQuestions} onCheckedChange={(x) => set("shuffleQuestions", x)} aria-label="Embaralhar questões" />
        </label>
        <label className="flex items-start justify-between gap-4 rounded-lg bg-surface-2/60 px-3 py-3">
          <span>
            <span className="block text-sm font-medium">Obrigatório para concluir</span>
            <span className="block text-small text-muted">A aula só conta como concluída com aprovação.</span>
          </span>
          <Switch checked={v.requiredToComplete} onCheckedChange={(x) => set("requiredToComplete", x)} aria-label="Obrigatório para concluir" />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {dirty && <Button type="button" variant="ghost" onClick={() => setV(base)}>Descartar</Button>}
        <Button type="submit" variant={dirty ? "primary" : "outline"} loading={pending} disabled={!dirty}>Salvar regras</Button>
      </div>
    </form>
  );
}

const EMPTY: Omit<QuizQuestion, "id"> = { type: "SINGLE_CHOICE", prompt: "", explanation: "", points: 1, acceptedAnswers: [], options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] };
const TF = [{ text: "Verdadeiro", isCorrect: true }, { text: "Falso", isCorrect: false }];

function QuestionDialog({ lessonId, value, onClose }: { lessonId: string; value: QuizQuestion | "new" | null; onClose: () => void }) {
  const [q, setQ] = useState<Omit<QuizQuestion, "id"> & { id?: string }>(EMPTY);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (value === "new") setQ(EMPTY);
    else if (value) setQ({ ...value, explanation: value.explanation ?? "", options: value.options.length ? value.options : value.type === "TRUE_FALSE" ? TF : EMPTY.options });
  }
  const { run, pending, error, fieldErrors } = useAction(saveQuestionAction);
  const choice = q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE";

  function setType(t: QuestionType) {
    setQ((s) => ({
      ...s,
      type: t,
      options: t === "TRUE_FALSE" ? TF : t === "SHORT_ANSWER" || t === "ESSAY" ? s.options : s.type === "TRUE_FALSE" || !s.options.length ? EMPTY.options : t === "SINGLE_CHOICE" ? s.options.map((o, i) => ({ ...o, isCorrect: i === s.options.findIndex((x) => x.isCorrect) })) : s.options,
    }));
  }

  function markCorrect(i: number) {
    setQ((s) => ({ ...s, options: s.options.map((o, k) => (s.type === "MULTIPLE_CHOICE" ? (k === i ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: k === i })) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({
      lessonId,
      questionId: q.id ?? null,
      type: q.type,
      prompt: q.prompt,
      explanation: q.explanation,
      points: q.points,
      acceptedAnswers: q.acceptedAnswers,
      options: choice ? q.options : [],
    });
    if (res?.ok) onClose();
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={q.id ? "Editar questão" : "Nova questão"}
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="question-form" loading={pending}>Salvar questão</Button>
          </>
        }
      >
        <form id="question-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          {error && <Alert tone="danger">{fieldErrors.options ?? fieldErrors.acceptedAnswers ?? error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Tipo de questão">
              <NativeSelect value={q.type} onChange={(e) => setType(e.target.value as QuestionType)}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>{QUESTION_TYPE[t]}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Pontos" error={fieldErrors.points}>
              <Input type="number" min={0} max={100} value={q.points} onChange={(e) => setQ((s) => ({ ...s, points: Number(e.target.value) }))} />
            </Field>
          </div>
          <Field label="Enunciado" required error={fieldErrors.prompt}>
            <Textarea value={q.prompt} onChange={(e) => setQ((s) => ({ ...s, prompt: e.target.value }))} rows={3} maxLength={4000} autoFocus />
          </Field>

          {choice && (
            <fieldset>
              <legend className="mb-2 text-small font-medium">
                Alternativas <span className="font-normal text-subtle">— {q.type === "MULTIPLE_CHOICE" ? "marque todas as corretas" : "marque a correta"}</span>
              </legend>
              <ul className="flex flex-col gap-2">
                {q.options.map((o, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => markCorrect(i)}
                      aria-pressed={o.isCorrect}
                      aria-label={`Marcar alternativa ${i + 1} como correta`}
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center border transition-colors",
                        q.type === "MULTIPLE_CHOICE" ? "rounded-md" : "rounded-full",
                        o.isCorrect ? "border-success bg-success-soft text-success" : "border-border-strong text-transparent hover:border-success hover:text-success/50",
                      )}
                    >
                      <Check className="size-4" />
                    </button>
                    <Input
                      value={o.text}
                      onChange={(e) => setQ((s) => ({ ...s, options: s.options.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) }))}
                      placeholder={`Alternativa ${i + 1}`}
                      maxLength={500}
                      readOnly={q.type === "TRUE_FALSE"}
                      aria-label={`Texto da alternativa ${i + 1}`}
                    />
                    {q.type !== "TRUE_FALSE" && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remover alternativa ${i + 1}`} disabled={q.options.length <= 2} onClick={() => setQ((s) => ({ ...s, options: s.options.filter((_, k) => k !== i) }))}>
                        <X />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {q.type !== "TRUE_FALSE" && (
                <Button type="button" variant="ghost" size="sm" className="mt-2" disabled={q.options.length >= 10} onClick={() => setQ((s) => ({ ...s, options: [...s.options, { text: "", isCorrect: false }] }))}>
                  <Plus /> Adicionar alternativa
                </Button>
              )}
            </fieldset>
          )}

          {q.type === "SHORT_ANSWER" && (
            <ListEditor
              label="Respostas aceitas"
              hint="A comparação ignora maiúsculas, acentos e espaços extras."
              items={q.acceptedAnswers}
              onChange={(a) => setQ((s) => ({ ...s, acceptedAnswers: a }))}
              placeholder="Ex.: Pentateuco"
            />
          )}
          {q.type === "ESSAY" && <Alert tone="info">Resposta livre do aluno. Você atribui a pontuação na fila de correção.</Alert>}

          <Field label="Explicação" hint="Opcional. Mostrada ao aluno junto do gabarito, conforme as regras do questionário." error={fieldErrors.explanation}>
            <Textarea value={q.explanation ?? ""} onChange={(e) => setQ((s) => ({ ...s, explanation: e.target.value }))} rows={2} maxLength={2000} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
