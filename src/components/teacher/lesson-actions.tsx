"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, MoreHorizontal, PlayCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import { deleteLessonAction, duplicateLessonAction, publishLessonAction } from "@/app/(app)/teacher/courses/[id]/actions";

export function LessonActions({ lessonId, courseId, isPublished, coursePublished }: { lessonId: string; courseId: string; isPublished: boolean; coursePublished: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const publish = useAction(publishLessonAction, { errorToast: true });
  const dup = useAction(duplicateLessonAction, { errorToast: true });
  const del = useAction(deleteLessonAction, { errorToast: true });

  async function toggle() {
    if (!isPublished && coursePublished) {
      const ok = await confirm({ title: "Publicar esta aula?", description: "Ela fica disponível imediatamente e os alunos matriculados recebem uma notificação.", confirmLabel: "Publicar", tone: "primary" });
      if (!ok) return;
    }
    if (isPublished && coursePublished) {
      const ok = await confirm({ title: "Despublicar esta aula?", description: "Os alunos deixam de vê-la e o progresso do curso é recalculado.", confirmLabel: "Despublicar", tone: "primary" });
      if (!ok) return;
    }
    publish.run({ id: lessonId, value: !isPublished });
  }

  async function remove() {
    const ok = await confirm({ title: "Excluir esta aula?", description: "O conteúdo, os materiais, as avaliações e o progresso dos alunos nesta aula serão excluídos. Esta ação não pode ser desfeita.", confirmLabel: "Excluir aula" });
    if (!ok) return;
    const r = await del.run({ id: lessonId });
    if (r?.ok) router.push(`/teacher/courses/${courseId}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" asChild>
        <Link href={`/learn/${courseId}/${lessonId}`} target="_blank">
          <PlayCircle /> Ver como aluno
        </Link>
      </Button>
      <Button variant={isPublished ? "outline" : "primary"} onClick={toggle} loading={publish.pending}>
        {isPublished ? <><EyeOff /> Despublicar</> : <><Eye /> Publicar aula</>}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações da aula">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={async () => {
              const r = await dup.run({ id: lessonId });
              if (r?.ok) router.push(`/teacher/courses/${courseId}/lessons/${r.data}`);
            }}
          >
            <Copy /> Duplicar aula
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onSelect={remove}>
            <Trash2 /> Excluir aula
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
