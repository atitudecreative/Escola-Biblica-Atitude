"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { MarkdownEditor } from "@/components/communication/markdown-editor";
import { createThreadAction } from "@/app/(app)/community/actions";

type Kind = "QUESTION" | "DISCUSSION";

export function ThreadForm({ courses, defaultType, defaultCourse }: { courses: { id: string; title: string }[]; defaultType: Kind; defaultCourse: string | null }) {
  const router = useRouter();
  const [type, setType] = useState<Kind>(defaultType);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState(defaultCourse ?? "");
  const { run, pending, fieldErrors, error } = useAction(createThreadAction, { errorToast: true });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ type, title, body, courseId: courseId || null });
    if (res?.ok) router.push(`/community/${res.data.id}`);
  }

  const kinds = [
    { value: "QUESTION" as const, icon: HelpCircle, label: "Pergunta", hint: "Tem uma dúvida? Alguém poderá marcar a resposta que resolveu." },
    { value: "DISCUSSION" as const, icon: MessagesSquare, label: "Discussão", hint: "Compartilhe uma reflexão, recurso ou puxe um assunto." },
  ];

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-small font-medium text-fg">Tipo de publicação</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={type === k.value}
              onClick={() => setType(k.value)}
              className={cn(
                "flex gap-3 rounded-lg border p-3.5 text-left transition-colors",
                type === k.value ? "border-primary bg-primary-soft/40 ring-1 ring-primary" : "border-border-strong bg-surface hover:bg-surface-2",
              )}
            >
              <k.icon className={cn("mt-0.5 size-5 shrink-0", type === k.value ? "text-primary" : "text-subtle")} aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-fg">{k.label}</span>
                <span className="mt-0.5 block text-caption text-muted">{k.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Título" error={fieldErrors.title} required hint={type === "QUESTION" ? "Resuma a dúvida em uma frase — ex.: “Como interpretar as genealogias de Gênesis?”" : undefined}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={type === "QUESTION" ? "Qual é a sua pergunta?" : "Sobre o que vamos conversar?"} />
      </Field>

      <Field label="Curso relacionado" error={fieldErrors.courseId} hint="Opcional. Ajuda professores e colegas do curso a encontrar sua publicação.">
        <NativeSelect value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Geral (sem curso)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Detalhes" error={fieldErrors.body} required>
        <MarkdownEditor
          value={body}
          onChange={setBody}
          rows={10}
          maxLength={20000}
          invalid={!!fieldErrors.body}
          placeholder={type === "QUESTION" ? "Explique o contexto: em qual aula surgiu a dúvida, o que você já entendeu e o que ainda não ficou claro." : "Desenvolva o assunto…"}
        />
      </Field>

      {error && !Object.keys(fieldErrors).length && <p role="alert" className="text-small font-medium text-danger">{error}</p>}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {type === "QUESTION" ? "Publicar pergunta" : "Publicar discussão"}
        </Button>
      </div>
    </form>
  );
}
