"use client";
import { useState } from "react";
import { CalendarClock, FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Markdown } from "@/components/markdown";
import { useAction } from "@/hooks/use-action";
import { submitAssignmentAction } from "@/app/learn/actions";
import { SUBMISSION_STATUS } from "@/lib/labels";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import type { assignmentStateFor } from "@/server/services/assessments";

type State = Awaited<ReturnType<typeof assignmentStateFor>>;

export function AssignmentPanel({ state, enrolled }: { state: State; enrolled: boolean }) {
  const { assignment, submission } = state;
  const [text, setText] = useState(submission?.textAnswer ?? "");
  const [file, setFile] = useState<{ id: string; name: string; sizeBytes: number } | null>(
    submission?.file ? { id: submission.file.id, name: submission.file.originalName, sizeBytes: submission.file.sizeBytes } : null,
  );
  const [editing, setEditing] = useState(!submission);
  const { run, pending, error } = useAction(submitAssignmentAction, { onSuccess: () => setEditing(false) });
  const status = submission?.status ?? "PENDING";
  const locked = submission && ["GRADING", "APPROVED", "REJECTED"].includes(submission.status);
  const overdue = assignment.dueAt && new Date(assignment.dueAt) < new Date() && !submission;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2">{assignment.title}</h2>
          <Badge tone={SUBMISSION_STATUS[status].tone} dot>{SUBMISSION_STATUS[status].label}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-small text-muted">
          {assignment.dueAt && (
            <span className={overdue ? "font-medium text-danger" : ""}>
              <CalendarClock className="mr-1 inline size-4" /> Prazo: {formatDateTime(assignment.dueAt)}
            </span>
          )}
          <span>Vale {assignment.maxScore} pontos · mínimo {assignment.passingScore}</span>
        </div>
        <Markdown className="mt-5 border-t border-border pt-5">{assignment.instructions || "Sem instruções adicionais."}</Markdown>
      </div>

      {submission && (submission.status === "APPROVED" || submission.status === "REJECTED" || submission.status === "RETURNED") && (
        <Alert
          tone={submission.status === "APPROVED" ? "success" : submission.status === "RETURNED" ? "warning" : "danger"}
          title={`${SUBMISSION_STATUS[submission.status].label}${submission.score != null ? ` · nota ${formatNumber(submission.score, 1)}/${assignment.maxScore}` : ""}`}
        >
          {submission.feedback ?? "Sem comentários do professor."}
          {submission.gradedBy && <span className="mt-1 block text-caption opacity-75">Corrigido por {submission.gradedBy.name}{submission.gradedAt ? ` em ${formatDateTime(submission.gradedAt)}` : ""}</span>}
        </Alert>
      )}

      {!enrolled ? (
        <Alert tone="info">Matricule-se no curso para enviar esta atividade.</Alert>
      ) : editing && !locked ? (
        <form
          className="space-y-4 rounded-xl border border-border bg-surface p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            run({ assignmentId: assignment.id, text, fileId: file?.id ?? null });
          }}
        >
          <h3 className="text-h3">{submission ? "Reenviar atividade" : "Sua entrega"}</h3>
          {assignment.allowText && (
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva sua resposta aqui…" className="min-h-48" maxLength={20000} aria-label="Resposta da atividade" />
          )}
          {assignment.allowFile &&
            (file ? (
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <Paperclip className="size-4 text-subtle" />
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <span className="text-caption text-subtle">{formatBytes(file.sizeBytes)}</span>
                <button type="button" onClick={() => setFile(null)} className="rounded p-1 text-subtle hover:text-danger" aria-label="Remover arquivo"><X className="size-4" /></button>
              </div>
            ) : (
              <FileDropzone purpose="submission" compact accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.txt" hint="PDF, DOCX, PPTX ou imagem · até 20 MB" onUploaded={(f) => setFile({ id: f.id, name: f.name, sizeBytes: f.sizeBytes })} />
            ))}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            {submission && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}
            <Button type="submit" loading={pending} disabled={!text.trim() && !file}>Enviar atividade</Button>
          </div>
        </form>
      ) : (
        submission && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-h4">Sua entrega · {formatDateTime(submission.submittedAt)}</h3>
              {!locked && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar entrega</Button>}
            </div>
            {submission.textAnswer && <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{submission.textAnswer}</p>}
            {submission.file && (
              <a href={`/api/files/${submission.file.id}?download=1`} className="mt-3 inline-flex items-center gap-2 text-small font-medium text-primary hover:underline">
                <FileText className="size-4" /> {submission.file.originalName}
              </a>
            )}
          </div>
        )
      )}
    </div>
  );
}
