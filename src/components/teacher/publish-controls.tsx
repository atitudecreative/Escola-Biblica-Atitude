"use client";
import { useState } from "react";
import Link from "next/link";
import type { CourseStatus } from "@prisma/client";
import { Archive, ArchiveRestore, ExternalLink, Eye, MoreHorizontal, PlayCircle, Rocket, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import { archiveAction, deleteCourseAction, publishAction, restoreAction, returnToDraftAction } from "@/app/(app)/teacher/courses/[id]/actions";

/**
 * Ações de ciclo de vida do curso. O botão principal muda conforme o status e
 * a política da escola: "Publicar" (quem pode publicar direto) ou "Enviar
 * para revisão" (quando a escola exige revisão).
 */
export function PublishControls({
  courseId,
  status,
  slug,
  firstLessonId,
  canPublishDirectly,
  isOwner,
  ready,
}: {
  courseId: string;
  status: CourseStatus;
  slug: string;
  firstLessonId: string | null;
  canPublishDirectly: boolean;
  isOwner: boolean;
  ready: boolean;
}) {
  const confirm = useConfirm();
  const publish = useAction(publishAction, { errorToast: true });
  const archive = useAction(archiveAction, { errorToast: true });
  const restore = useAction(restoreAction, { errorToast: true });
  const back = useAction(returnToDraftAction, { errorToast: true });
  const del = useAction(deleteCourseAction, { errorToast: true });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function onPublish() {
    if (!ready) {
      toast.error("Ainda não dá para publicar", { description: "Publique ao menos uma aula no currículo." });
      return;
    }
    const direct = canPublishDirectly;
    const ok = await confirm({
      title: direct ? "Publicar o curso?" : "Enviar para revisão?",
      description: direct
        ? "O curso aparece no catálogo e os alunos já podem se matricular."
        : "A coordenação vai revisar o curso antes da publicação. Você continua podendo editar enquanto isso.",
      confirmLabel: direct ? "Publicar" : "Enviar para revisão",
      tone: "primary",
    });
    if (!ok) return;
    const res = await publish.run({ id: courseId });
    if (res?.ok) {
      if (res.data === "PUBLISHED") toast.success("Curso publicado", { description: "Ele já aparece no catálogo." });
      else toast.success("Curso enviado para revisão", { description: "Avisaremos você quando for analisado." });
    }
  }

  async function onArchive() {
    const ok = await confirm({
      title: "Arquivar o curso?",
      description: "Ele sai do catálogo e não aceita novas matrículas. Alunos já matriculados mantêm o acesso ao conteúdo.",
      confirmLabel: "Arquivar",
    });
    if (ok) archive.run({ id: courseId });
  }

  async function onRestore() {
    const res = await restore.run({ id: courseId });
    if (res?.ok) toast.success(res.data === "PUBLISHED" ? "Curso restaurado e publicado." : "Curso restaurado como rascunho.");
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Excluir este rascunho?",
      description: "Módulos, aulas, materiais e avaliações serão excluídos permanentemente. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir curso",
    });
    if (ok) del.run({ id: courseId });
  }

  async function onCancelReview() {
    const res = await back.run({ id: courseId });
    if (res?.ok) setRejectOpen(false);
  }

  const reviewer = canPublishDirectly;
  const busy = publish.pending || archive.pending || restore.pending || back.pending || del.pending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Eye /> Visualizar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild>
            <Link href={`/courses/${slug}`} target="_blank">
              <ExternalLink /> Página do curso
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild disabled={!firstLessonId}>
            <Link href={firstLessonId ? `/learn/${courseId}/${firstLessonId}` : "#"} target="_blank">
              <PlayCircle /> Assistir como aluno
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {(status === "DRAFT" || (status === "REVIEW" && reviewer)) && (
        <Button onClick={onPublish} loading={publish.pending} disabled={busy}>
          {reviewer ? <Rocket /> : <Send />}
          {status === "REVIEW" ? "Aprovar e publicar" : reviewer ? "Publicar" : "Enviar para revisão"}
        </Button>
      )}
      {status === "REVIEW" && !reviewer && (
        <Button variant="outline" onClick={onCancelReview} loading={back.pending} disabled={busy}>
          <Undo2 /> Cancelar envio
        </Button>
      )}
      {status === "ARCHIVED" && (
        <Button onClick={onRestore} loading={restore.pending} disabled={busy}>
          <ArchiveRestore /> Restaurar
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações do curso" disabled={busy}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {status === "REVIEW" && reviewer && !isOwner && (
            <DropdownMenuItem onSelect={() => setRejectOpen(true)}>
              <Undo2 /> Devolver ao professor
            </DropdownMenuItem>
          )}
          {status === "REVIEW" && reviewer && isOwner && (
            <DropdownMenuItem onSelect={onCancelReview}>
              <Undo2 /> Voltar para rascunho
            </DropdownMenuItem>
          )}
          {status !== "ARCHIVED" && (
            <DropdownMenuItem onSelect={onArchive}>
              <Archive /> Arquivar curso
            </DropdownMenuItem>
          )}
          {status === "ARCHIVED" && (
            <DropdownMenuItem onSelect={onRestore}>
              <ArchiveRestore /> Restaurar curso
            </DropdownMenuItem>
          )}
          {status === "DRAFT" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={onDelete}>
                <Trash2 /> Excluir rascunho
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent
          title="Devolver ao professor"
          description="O curso volta para rascunho e o professor é notificado com a sua mensagem."
          footer={
            <>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
              <Button onClick={() => back.run({ id: courseId, reason }).then((r) => r?.ok && setRejectOpen(false))} loading={back.pending}>
                Devolver
              </Button>
            </>
          }
        >
          <Field label="O que precisa ser ajustado?" hint="Opcional, mas ajuda o professor.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}
