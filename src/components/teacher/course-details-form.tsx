"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, ImageOff, Plus, Trash2 } from "lucide-react";
import type { CourseLevel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { CourseCover } from "@/components/course/course-cover";
import { useAction } from "@/hooks/use-action";
import { updateDetailsAction } from "@/app/(app)/teacher/courses/[id]/actions";
import { COURSE_LEVEL } from "@/lib/labels";
import { COURSE_LEVELS } from "@/lib/validation/teacher";
import { slugify } from "@/lib/utils";
import { ListEditor, MarkdownEditor, SaveBar, TagInput } from "./form-helpers";

export type CourseDetailsValue = {
  courseId: string;
  title: string;
  subtitle: string;
  slug: string;
  description: string;
  coverUrl: string;
  trailerUrl: string;
  categoryId: string;
  level: CourseLevel;
  language: string;
  workloadHours: number;
  tags: string[];
  objectives: string[];
  requirements: string[];
  targetAudience: string[];
  faq: { question: string; answer: string }[];
};

const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "es", label: "Espanhol" },
  { value: "en", label: "Inglês" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-border py-6 first:pt-0 last:border-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      <div>
        <h3 className="text-h4">{title}</h3>
        {description && <p className="mt-1 text-small text-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export function CourseDetailsForm({
  initial,
  categories,
  tagSuggestions,
  categoryName,
}: {
  initial: CourseDetailsValue;
  categories: { id: string; name: string }[];
  tagSuggestions: string[];
  categoryName?: string | null;
}) {
  const [v, setV] = useState(initial);
  const [base, setBase] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setBase(initial);
    setV(initial);
  }
  const { run, pending, error, fieldErrors } = useAction(updateDetailsAction, { errorToast: true });
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  const set = <K extends keyof CourseDetailsValue>(k: K, val: CourseDetailsValue[K]) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ ...v, categoryId: v.categoryId || null });
    if (res?.ok) setBase(v);
  }

  const category = categories.find((c) => c.id === v.categoryId)?.name ?? categoryName;

  return (
    <form onSubmit={submit} noValidate>
      {error && Object.keys(fieldErrors).length > 0 && (
        <Alert tone="danger" className="mb-6">
          {error}
        </Alert>
      )}
      <Section title="Informações básicas" description="Como o curso aparece no catálogo e nos resultados de busca.">
        <Field label="Título" required error={fieldErrors.title}>
          <Input value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
        </Field>
        <Field label="Subtítulo" error={fieldErrors.subtitle}>
          <Input value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={200} />
        </Field>
        <Field
          label="Endereço (slug)"
          error={fieldErrors.slug}
          hint={`Link público: /courses/${v.slug || "…"}. Alterar o endereço quebra links já compartilhados.`}
          labelAction={
            <button type="button" className="text-small font-medium text-primary hover:underline" onClick={() => set("slug", slugify(v.title))}>
              Gerar do título
            </button>
          }
        >
          <Input value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={80} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Categoria" error={fieldErrors.categoryId}>
            <NativeSelect value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Nível" error={fieldErrors.level}>
            <NativeSelect value={v.level} onChange={(e) => set("level", e.target.value as CourseLevel)}>
              {COURSE_LEVELS.map((l) => (
                <option key={l} value={l}>{COURSE_LEVEL[l]}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Idioma" error={fieldErrors.language}>
            <NativeSelect value={v.language} onChange={(e) => set("language", e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Carga horária (horas)" error={fieldErrors.workloadHours} hint="Informada no certificado. Pode ser diferente da duração dos vídeos." className="sm:max-w-56">
          <Input type="number" inputMode="numeric" min={0} max={2000} value={v.workloadHours} onChange={(e) => set("workloadHours", Number(e.target.value))} />
        </Field>
        <TagInput value={v.tags} onChange={(t) => set("tags", t)} suggestions={tagSuggestions} />
      </Section>

      <Section title="Descrição" description="Apresente o curso: para quem é, o que se estuda e como funciona.">
        <Field label="Descrição completa" error={fieldErrors.description}>
          <MarkdownEditor value={v.description} onChange={(t) => set("description", t)} rows={12} placeholder="Escreva sobre o curso…" />
        </Field>
      </Section>

      <Section title="Capa e trailer" description="Imagem 16:9 (JPG, PNG ou WebP, até 5 MB). Sem capa, geramos uma arte com o título.">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <CourseCover title={v.title || "Novo curso"} category={category} src={v.coverUrl || null} className="rounded-lg border border-border" />
            {v.coverUrl && (
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => set("coverUrl", "")}>
                <ImageOff /> Remover capa
              </Button>
            )}
          </div>
          <FileDropzone
            purpose="cover"
            accept="image/jpeg,image/png,image/webp"
            label={v.coverUrl ? "Trocar capa" : "Enviar capa"}
            hint="Recomendado: 1600 × 900 px"
            onUploaded={(f) => set("coverUrl", f.url)}
            className="self-start"
          />
        </div>
        <Field label="Trailer (URL do vídeo)" error={fieldErrors.trailerUrl} hint="YouTube, Vimeo ou link direto para MP4.">
          <Input type="url" value={v.trailerUrl} onChange={(e) => set("trailerUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        </Field>
      </Section>

      <Section title="Para quem e para quê" description="Listas curtas, uma ideia por linha.">
        <ListEditor label="O que o aluno vai aprender" items={v.objectives} onChange={(x) => set("objectives", x)} placeholder="Ex.: Entender a estrutura do Antigo Testamento" />
        <ListEditor label="Pré-requisitos" items={v.requirements} onChange={(x) => set("requirements", x)} placeholder="Ex.: Nenhum — o curso é introdutório" />
        <ListEditor label="Público-alvo" items={v.targetAudience} onChange={(x) => set("targetAudience", x)} placeholder="Ex.: Líderes de pequenos grupos" />
      </Section>

      <Section title="Perguntas frequentes" description="Dúvidas comuns respondidas na página do curso.">
        {v.faq.length === 0 && <p className="text-small text-subtle">Nenhuma pergunta cadastrada.</p>}
        {v.faq.map((f, i) => (
          <div key={i} className="rounded-lg border border-border p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-overline text-subtle">Pergunta {i + 1}</span>
              <div className="flex">
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Mover para cima" disabled={i === 0} onClick={() => { const n = [...v.faq]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set("faq", n); }}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Mover para baixo" disabled={i === v.faq.length - 1} onClick={() => { const n = [...v.faq]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set("faq", n); }}><ArrowDown /></Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover pergunta" onClick={() => set("faq", v.faq.filter((_, k) => k !== i))}><Trash2 /></Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Field label="Pergunta" error={fieldErrors[`faq.${i}.question`]}>
                <Input value={f.question} onChange={(e) => set("faq", v.faq.map((x, k) => (k === i ? { ...x, question: e.target.value } : x)))} maxLength={240} />
              </Field>
              <Field label="Resposta" error={fieldErrors[`faq.${i}.answer`]}>
                <Textarea value={f.answer} onChange={(e) => set("faq", v.faq.map((x, k) => (k === i ? { ...x, answer: e.target.value } : x)))} rows={3} maxLength={2000} />
              </Field>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" className="self-start" onClick={() => set("faq", [...v.faq, { question: "", answer: "" }])} disabled={v.faq.length >= 20}>
          <Plus /> Adicionar pergunta
        </Button>
      </Section>

      <SaveBar dirty={dirty} pending={pending} onReset={() => setV(base)} />
    </form>
  );
}
