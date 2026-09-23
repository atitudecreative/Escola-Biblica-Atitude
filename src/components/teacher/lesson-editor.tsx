"use client";
import { useState } from "react";
import type { LessonType, VideoProvider } from "@prisma/client";
import { FileText, Link2, Paperclip, Plus, Trash2, X, Captions } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { LessonTypeIcon } from "@/components/course/lesson-type-icon";
import { useAction } from "@/hooks/use-action";
import { addMaterialAction, removeMaterialAction, updateLessonAction } from "@/app/(app)/teacher/courses/[id]/actions";
import { LESSON_TYPE } from "@/lib/labels";
import { LESSON_TYPES } from "@/lib/validation/teacher";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MarkdownEditor, SaveBar } from "./form-helpers";

type FileInfo = { id: string; name: string; mimeType: string; sizeBytes: number } | null;

export type LessonValue = {
  lessonId: string;
  title: string;
  summary: string;
  type: LessonType;
  content: string;
  videoProvider: VideoProvider;
  videoUrl: string;
  captionsUrl: string;
  externalUrl: string;
  mediaFileId: string;
  durationMinutes: number;
  durationSecondsPart: number;
  isPreview: boolean;
};

const PROVIDERS: { value: VideoProvider; label: string; hint: string }[] = [
  { value: "YOUTUBE", label: "YouTube", hint: "Cole o link do vídeo (público ou não listado)." },
  { value: "VIMEO", label: "Vimeo", hint: "Cole o link do vídeo no Vimeo." },
  { value: "URL", label: "Link direto", hint: "Endereço de um arquivo MP4 ou WebM hospedado." },
  { value: "UPLOAD", label: "Enviar arquivo", hint: "MP4 ou WebM enviado para a plataforma." },
];

const FILE_TYPES: Partial<Record<LessonType, { accept: string; label: string; hint: string }>> = {
  PDF: { accept: "application/pdf", label: "Enviar PDF", hint: "O aluno lê o PDF dentro da aula." },
  AUDIO: { accept: "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg", label: "Enviar áudio", hint: "MP3, M4A, WAV ou OGG." },
  PRESENTATION: { accept: ".pdf,.ppt,.pptx", label: "Enviar apresentação", hint: "Prefira PDF para exibir direto na aula; PPT/PPTX ficam para download." },
  FILE: { accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt", label: "Enviar arquivo", hint: "Documento para download." },
};

const CONTENT_LABEL: Partial<Record<LessonType, string>> = {
  TEXT: "Texto da aula",
  QUIZ: "Orientações antes do questionário",
  ASSIGNMENT: "Texto de apoio",
};

export function LessonEditor({ initial, mediaFile, hasResponses }: { initial: LessonValue; mediaFile: FileInfo; hasResponses: boolean }) {
  const [v, setV] = useState(initial);
  const [base, setBase] = useState(initial);
  const [file, setFile] = useState<FileInfo>(mediaFile);
  const [baseFile, setBaseFile] = useState<FileInfo>(mediaFile);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setBase(initial);
    setV(initial);
    setFile(mediaFile);
    setBaseFile(mediaFile);
  }
  const { run, pending, error, fieldErrors } = useAction(updateLessonAction, { errorToast: true });
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  const set = <K extends keyof LessonValue>(k: K, val: LessonValue[K]) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ ...v, mediaFileId: v.mediaFileId || null, videoProvider: v.type === "VIDEO" ? v.videoProvider : null });
    if (res?.ok) {
      setBase(v);
      setBaseFile(file);
    }
  }

  const fileCfg = FILE_TYPES[v.type];
  const assessmentLocked = hasResponses && (initial.type === "QUIZ" || initial.type === "ASSIGNMENT");

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {error && Object.keys(fieldErrors).length > 0 && <Alert tone="danger">{error}</Alert>}

      <section className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
        <fieldset disabled={assessmentLocked}>
          <legend className="mb-2 text-small font-medium">Tipo de aula</legend>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-9">
            {LESSON_TYPES.map((t) => (
              <label
                key={t}
                className={cn(
                  "flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 text-center text-caption font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                  v.type === t ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <input type="radio" className="sr-only" name="type" value={t} checked={v.type === t} onChange={() => set("type", t)} />
                <LessonTypeIcon type={t} className="size-4" />
                {LESSON_TYPE[t]}
              </label>
            ))}
          </div>
        </fieldset>
        {assessmentLocked && <p className="mt-2 text-caption text-subtle">O tipo não pode mudar porque já há respostas de alunos.</p>}
        {fieldErrors.type && <p role="alert" className="mt-2 text-caption font-medium text-danger">{fieldErrors.type}</p>}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
        <Field label="Título" required error={fieldErrors.title}>
          <Input value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
        </Field>
        <Field label="Resumo" hint="Uma ou duas frases exibidas na lista de aulas." error={fieldErrors.summary}>
          <Textarea value={v.summary} onChange={(e) => set("summary", e.target.value)} rows={2} maxLength={500} className="min-h-16" />
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
          <Field label="Duração (min)" error={fieldErrors.durationMinutes}>
            <Input type="number" inputMode="numeric" min={0} max={1000} value={v.durationMinutes} onChange={(e) => set("durationMinutes", Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Segundos" error={fieldErrors.durationSecondsPart}>
            <Input type="number" inputMode="numeric" min={0} max={59} value={v.durationSecondsPart} onChange={(e) => set("durationSecondsPart", Math.min(59, Math.max(0, Number(e.target.value) || 0)))} />
          </Field>
        </div>
        <label className="flex items-start justify-between gap-4 rounded-lg bg-surface-2/60 px-3 py-3">
          <span>
            <span className="block text-sm font-medium">Prévia gratuita</span>
            <span className="block text-small text-muted">Qualquer visitante pode assistir a esta aula sem se matricular.</span>
          </span>
          <Switch checked={v.isPreview} onCheckedChange={(x) => set("isPreview", x)} aria-label="Prévia gratuita" />
        </label>
      </section>

      {v.type === "VIDEO" && (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
          <h3 className="text-h4">Vídeo</h3>
          <div role="radiogroup" aria-label="Origem do vídeo" className="inline-flex flex-wrap gap-0.5 self-start rounded-lg bg-surface-2 p-0.5">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={v.videoProvider === p.value}
                onClick={() => set("videoProvider", p.value)}
                className={cn("h-8 rounded-md px-3 text-small font-medium transition-all", v.videoProvider === p.value ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg")}
              >
                {p.label}
              </button>
            ))}
          </div>
          {v.videoProvider === "UPLOAD" ? (
            <div className="flex flex-col gap-2">
              {v.videoUrl && file ? (
                <FileChip file={file} onRemove={() => { setFile(null); setV((s) => ({ ...s, videoUrl: "", mediaFileId: "" })); }} />
              ) : (
                <FileDropzone
                  purpose="lessonMedia"
                  accept="video/mp4,video/webm"
                  label="Enviar vídeo"
                  hint="MP4 ou WebM"
                  onUploaded={(f) => {
                    setFile({ id: f.id, name: f.name, mimeType: f.mimeType, sizeBytes: f.sizeBytes });
                    setV((s) => ({ ...s, videoUrl: f.url, mediaFileId: f.id }));
                  }}
                />
              )}
              {fieldErrors.videoUrl && <p role="alert" className="text-caption font-medium text-danger">{fieldErrors.videoUrl}</p>}
            </div>
          ) : (
            <Field label="Endereço do vídeo" hint={PROVIDERS.find((p) => p.value === v.videoProvider)?.hint} error={fieldErrors.videoUrl}>
              <Input type="url" value={v.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder={v.videoProvider === "VIMEO" ? "https://vimeo.com/…" : v.videoProvider === "YOUTUBE" ? "https://www.youtube.com/watch?v=…" : "https://…/video.mp4"} />
            </Field>
          )}
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-small font-medium"><Captions className="size-4 text-subtle" /> Legendas (WebVTT)</p>
            {v.captionsUrl ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-small">
                <span className="truncate text-muted">Arquivo de legendas anexado</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => set("captionsUrl", "")}><X /> Remover</Button>
              </div>
            ) : (
              <FileDropzone purpose="lessonMedia" accept=".vtt,text/vtt" compact label="Enviar legendas .vtt" hint="Melhora a acessibilidade da aula." onUploaded={(f) => set("captionsUrl", f.url)} />
            )}
          </div>
        </section>
      )}

      {fileCfg && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
          <h3 className="text-h4">Arquivo principal</h3>
          {file && v.mediaFileId ? (
            <FileChip file={file} onRemove={() => { setFile(null); set("mediaFileId", ""); }} />
          ) : (
            <FileDropzone
              purpose="lessonMedia"
              accept={fileCfg.accept}
              label={fileCfg.label}
              hint={fileCfg.hint}
              onUploaded={(f) => {
                setFile({ id: f.id, name: f.name, mimeType: f.mimeType, sizeBytes: f.sizeBytes });
                set("mediaFileId", f.id);
              }}
            />
          )}
          {fieldErrors.mediaFileId && <p role="alert" className="text-caption font-medium text-danger">{fieldErrors.mediaFileId}</p>}
        </section>
      )}

      {v.type === "LINK" && (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
          <Field label="Endereço do link" required hint="O aluno abre o link em uma nova aba." error={fieldErrors.externalUrl}>
            <Input type="url" value={v.externalUrl} onChange={(e) => set("externalUrl", e.target.value)} placeholder="https://…" />
          </Field>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
        <Field label={CONTENT_LABEL[v.type] ?? "Anotações e texto complementar"} hint={v.type === "TEXT" ? undefined : "Opcional. Aparece abaixo do conteúdo principal."} error={fieldErrors.content}>
          <MarkdownEditor value={v.content} onChange={(t) => set("content", t)} rows={v.type === "TEXT" ? 16 : 8} placeholder="Escreva em Markdown…" />
        </Field>
      </section>

      <SaveBar dirty={dirty || file?.id !== baseFile?.id} pending={pending} onReset={() => { setV(base); setFile(baseFile); }} label="Salvar aula" />
    </form>
  );
}

function FileChip({ file, onRemove }: { file: NonNullable<FileInfo>; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted"><FileText className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:text-primary">{file.name}</a>
        <p className="text-caption text-subtle">{file.mimeType} · {formatBytes(file.sizeBytes)}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}><X /> Trocar</Button>
    </div>
  );
}

// ── Materiais complementares ─────────────────────────────────────────

export type MaterialItem = { id: string; title: string; kind: "FILE" | "LINK"; url: string | null; fileId: string | null; file: { originalName: string; mimeType: string; sizeBytes: number } | null };

export function MaterialsEditor({ lessonId, materials }: { lessonId: string; materials: MaterialItem[] }) {
  const confirm = useConfirm();
  const add = useAction(addMaterialAction, { errorToast: true });
  const remove = useAction(removeMaterialAction, { errorToast: true });
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ title: "", url: "" });

  async function onRemove(m: MaterialItem) {
    const ok = await confirm({ title: `Remover “${m.title}”?`, description: "O material deixa de aparecer para os alunos nesta aula.", confirmLabel: "Remover" });
    if (ok) remove.run({ id: m.id });
  }

  return (
    <section className="rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div>
          <h3 className="text-h4">Materiais complementares</h3>
          <p className="text-caption text-subtle">Apostilas, slides, leituras e links.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setLinkOpen(true)}><Link2 /> Link</Button>
      </div>
      {materials.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
                {m.kind === "LINK" ? <Link2 className="size-4" /> : <Paperclip className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <a href={m.kind === "LINK" ? (m.url ?? "#") : `/api/files/${m.fileId}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:text-primary">{m.title}</a>
                <p className="truncate text-caption text-subtle">
                  {m.kind === "LINK" ? m.url : m.file ? `${m.file.originalName.split(".").pop()?.toUpperCase()} · ${formatBytes(m.file.sizeBytes)}` : "Arquivo indisponível"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${m.title}`} onClick={() => onRemove(m)} disabled={remove.pending}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="p-4">
        <FileDropzone
          purpose="material"
          compact
          label={add.pending ? "Adicionando…" : "Enviar arquivo"}
          hint="PDF, DOC, PPT, XLS, ZIP, imagens ou áudio · até 50 MB"
          onUploaded={(f) => add.run({ lessonId, kind: "FILE", fileId: f.id, title: f.name.replace(/\.[^.]+$/, "") })}
        />
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent
          title="Adicionar link"
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>Cancelar</Button>
              <Button
                type="button"
                loading={add.pending}
                onClick={async () => {
                  const r = await add.run({ lessonId, kind: "LINK", title: link.title, url: link.url });
                  if (r?.ok) {
                    setLink({ title: "", url: "" });
                    setLinkOpen(false);
                  }
                }}
              >
                <Plus /> Adicionar
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Nome" required error={add.fieldErrors.title}>
              <Input value={link.title} onChange={(e) => setLink((s) => ({ ...s, title: e.target.value }))} maxLength={160} placeholder="Ex.: Leitura complementar" />
            </Field>
            <Field label="Endereço" required error={add.fieldErrors.url}>
              <Input type="url" value={link.url} onChange={(e) => setLink((s) => ({ ...s, url: e.target.value }))} placeholder="https://…" />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
