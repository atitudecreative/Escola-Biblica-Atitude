"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { updateAssignmentAction } from "@/app/(app)/teacher/courses/[id]/actions";
import { pluralize } from "@/lib/format";
import { MarkdownEditor, SaveBar } from "./form-helpers";

export type AssignmentValue = {
  instructions: string;
  dueAt: string | null; // ISO
  maxScore: number;
  passingScore: number;
  allowText: boolean;
  allowFile: boolean;
};

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const noop = () => () => {};

export function AssignmentEditor({ lessonId, initial, submissions, pending: pendingCount, courseId }: { lessonId: string; initial: AssignmentValue; submissions: number; pending: number; courseId: string }) {
  const [v, setV] = useState(initial);
  const [base, setBase] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setV(initial);
    setBase(initial);
  }
  // O fuso só é conhecido no navegador: evita divergência de hidratação.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { run, pending, fieldErrors } = useAction(updateAssignmentAction, { errorToast: true });
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  const set = <K extends keyof AssignmentValue>(k: K, val: AssignmentValue[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run({ lessonId, ...v });
        if (r?.ok) setBase(v);
      }}
      className="flex flex-col gap-6"
    >
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h4">Atividade</h3>
          {submissions > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/grading?course=${courseId}&kind=assignment`}>
                {pluralize(submissions, "entrega", "entregas")}
                {pendingCount > 0 ? ` · ${pendingCount} para corrigir` : ""}
              </Link>
            </Button>
          )}
        </div>
        <Field label="Instruções" hint="O que o aluno deve fazer, critérios de avaliação e formato esperado." error={fieldErrors.instructions}>
          <MarkdownEditor value={v.instructions} onChange={(t) => set("instructions", t)} rows={10} placeholder="Ex.: Leia Romanos 8 e escreva uma reflexão de uma página…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prazo de entrega" hint="Opcional. Entregas depois do prazo ficam marcadas como atrasadas." error={fieldErrors.dueAt}>
            <Input
              type="datetime-local"
              value={mounted ? toLocalInput(v.dueAt) : ""}
              onChange={(e) => set("dueAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </Field>
          <Field label="Nota máxima" error={fieldErrors.maxScore}>
            <Input type="number" min={1} max={1000} value={v.maxScore} onChange={(e) => set("maxScore", Number(e.target.value))} />
          </Field>
          <Field label="Nota mínima para aprovação" error={fieldErrors.passingScore}>
            <Input type="number" min={0} max={1000} value={v.passingScore} onChange={(e) => set("passingScore", Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start justify-between gap-4 rounded-lg bg-surface-2/60 px-3 py-3">
            <span>
              <span className="block text-sm font-medium">Resposta em texto</span>
              <span className="block text-small text-muted">O aluno escreve a resposta na plataforma.</span>
            </span>
            <Switch checked={v.allowText} onCheckedChange={(x) => set("allowText", x)} aria-label="Permitir resposta em texto" />
          </label>
          <label className="flex items-start justify-between gap-4 rounded-lg bg-surface-2/60 px-3 py-3">
            <span>
              <span className="block text-sm font-medium">Envio de arquivo</span>
              <span className="block text-small text-muted">PDF, DOC, imagens · até 20 MB.</span>
            </span>
            <Switch checked={v.allowFile} onCheckedChange={(x) => set("allowFile", x)} aria-label="Permitir envio de arquivo" />
          </label>
        </div>
        {fieldErrors.allowText && <p role="alert" className="text-caption font-medium text-danger">{fieldErrors.allowText}</p>}
        <SaveBar dirty={dirty} pending={pending} onReset={() => setV(base)} label="Salvar atividade" floating={false} />
      </section>
    </form>
  );
}
