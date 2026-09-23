"use client";
import { useState } from "react";
import Link from "next/link";
import { Archive, Check, ExternalLink, MoreHorizontal, PencilLine, Star, StarOff, Undo2, UserCog, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { BulkBar } from "@/components/data/bulk-select";
import { useAction } from "@/hooks/use-action";
import {
  approveCourseAction,
  bulkCourseAction,
  changeInstructorAction,
  featureCourseAction,
  returnCourseAction,
} from "@/app/(app)/admin/courses/actions";

type Teacher = { id: string; name: string; email: string };
type CourseRef = { id: string; title: string; slug: string; status: string; isFeatured: boolean; instructorId: string };

export function ReviewActions({ course }: { course: { id: string; title: string } }) {
  const confirm = useConfirm();
  const approve = useAction(approveCourseAction, { errorToast: true });
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Undo2 /> Devolver
      </Button>
      <Button
        size="sm"
        loading={approve.pending}
        onClick={async () => {
          const ok = await confirm({
            title: "Aprovar e publicar?",
            description: `"${course.title}" ficará visível no catálogo e o professor será notificado.`,
            confirmLabel: "Aprovar e publicar",
            tone: "primary",
          });
          if (ok) approve.run(course.id);
        }}
      >
        <Check /> Aprovar
      </Button>
      <ReturnDialog course={course} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ReturnDialog({ course, open, onOpenChange }: { course: { id: string; title: string }; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [comment, setComment] = useState("");
  const act = useAction(returnCourseAction, {
    onSuccess: () => {
      setComment("");
      onOpenChange(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Devolver para ajustes"
        description={`O curso "${course.title}" volta para rascunho e o professor recebe seu comentário.`}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button loading={act.pending} onClick={() => act.run({ id: course.id, comment })}>
              <Send /> Devolver ao professor
            </Button>
          </>
        }
      >
        <Field label="O que precisa ser ajustado?" error={act.fieldErrors.comment ?? (act.fieldErrors._ ? act.error : null)} required hint="Seja específico: aulas, materiais, descrição, avaliação…">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={5} maxLength={1000} placeholder="Ex.: O módulo 2 está sem aulas publicadas e a descrição do curso precisa dos objetivos." />
        </Field>
        {act.error && !act.fieldErrors.comment && <p className="mt-2 text-small text-danger">{act.error}</p>}
      </DialogContent>
    </Dialog>
  );
}

export function CourseRowMenu({ course, teachers }: { course: CourseRef; teachers: Teacher[] }) {
  const confirm = useConfirm();
  const [instructorOpen, setInstructorOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const feature = useAction(featureCourseAction, {
    errorToast: true,
    onSuccess: (on) => toast.success(on ? "Curso destacado na home." : "Curso removido dos destaques."),
  });
  const bulk = useAction(bulkCourseAction, { errorToast: true });
  const approve = useAction(approveCourseAction, { errorToast: true });

  async function publish() {
    const ok = await confirm({
      title: "Publicar curso?",
      description: `"${course.title}" ficará visível no catálogo.`,
      confirmLabel: "Publicar",
      tone: "primary",
    });
    if (ok) approve.run(course.id);
  }
  async function archive() {
    const ok = await confirm({
      title: "Arquivar curso?",
      description: "O curso sai do catálogo e dos destaques. Alunos matriculados mantêm o histórico. Você pode publicá-lo novamente depois.",
      confirmLabel: "Arquivar",
    });
    if (!ok) return;
    const r = await bulk.run({ ids: [course.id], action: "archive" });
    if (r?.ok) toast.success("Curso arquivado.");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${course.title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <Link href={`/teacher/courses/${course.id}`}>
              <PencilLine /> Editar no builder
            </Link>
          </DropdownMenuItem>
          {course.status === "PUBLISHED" && (
            <DropdownMenuItem asChild>
              <Link href={`/courses/${course.slug}`} target="_blank">
                <ExternalLink /> Ver página pública
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {course.status === "PUBLISHED" && (
            <DropdownMenuItem onSelect={() => feature.run({ id: course.id, featured: !course.isFeatured })}>
              {course.isFeatured ? <StarOff /> : <Star />}
              {course.isFeatured ? "Remover dos destaques" : "Destacar na home"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setInstructorOpen(true)}>
            <UserCog /> Trocar professor
          </DropdownMenuItem>
          {course.status === "REVIEW" && (
            <DropdownMenuItem onSelect={() => setReturnOpen(true)}>
              <Undo2 /> Devolver para ajustes
            </DropdownMenuItem>
          )}
          {course.status !== "PUBLISHED" && (
            <DropdownMenuItem onSelect={publish}>
              <Check /> {course.status === "REVIEW" ? "Aprovar e publicar" : "Publicar"}
            </DropdownMenuItem>
          )}
          {course.status !== "ARCHIVED" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={archive}>
                <Archive /> Arquivar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <InstructorDialog course={course} teachers={teachers} open={instructorOpen} onOpenChange={setInstructorOpen} />
      <ReturnDialog course={course} open={returnOpen} onOpenChange={setReturnOpen} />
    </>
  );
}

function InstructorDialog({
  course,
  teachers,
  open,
  onOpenChange,
}: {
  course: CourseRef;
  teachers: Teacher[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [value, setValue] = useState(course.instructorId);
  const act = useAction(changeInstructorAction, { onSuccess: () => onOpenChange(false) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Trocar professor responsável"
        description={`O novo responsável passa a editar "${course.title}" e corrigir as atividades.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button loading={act.pending} disabled={value === course.instructorId} onClick={() => act.run({ id: course.id, instructorId: value })}>
              Salvar
            </Button>
          </>
        }
      >
        <Field label="Professor" error={act.fieldErrors.instructorId ?? act.error}>
          <NativeSelect value={value} onChange={(e) => setValue(e.target.value)}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.email}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </DialogContent>
    </Dialog>
  );
}

export function CoursesBulkBar() {
  const confirm = useConfirm();
  const act = useAction(bulkCourseAction, { errorToast: true });
  return (
    <BulkBar>
      {(ids, clear) => (
        <>
          <Button
            size="sm"
            variant="outline"
            loading={act.pending}
            onClick={async () => {
              const ok = await confirm({
                title: `Arquivar ${ids.length} curso(s)?`,
                description: "Os cursos saem do catálogo e dos destaques. É possível publicá-los de novo depois.",
                confirmLabel: "Arquivar",
              });
              if (!ok) return;
              const r = await act.run({ ids, action: "archive" });
              if (r?.ok) {
                toast.success(`${(r.data as { archived?: number }).archived ?? 0} curso(s) arquivado(s).`);
                clear();
              }
            }}
          >
            <Archive /> Arquivar
          </Button>
          <Button
            size="sm"
            loading={act.pending}
            onClick={async () => {
              const ok = await confirm({
                title: `Publicar ${ids.length} curso(s)?`,
                description: "Cursos sem aulas são ignorados. Os professores serão notificados.",
                confirmLabel: "Publicar",
                tone: "primary",
              });
              if (!ok) return;
              const r = await act.run({ ids, action: "publish" });
              if (r?.ok) {
                const d = r.data as { published: number; skipped: number };
                toast.success(
                  `${d.published} curso(s) publicado(s).` + (d.skipped ? ` ${d.skipped} ignorado(s) por não ter aulas.` : ""),
                );
                clear();
              }
            }}
          >
            <Check /> Publicar
          </Button>
        </>
      )}
    </BulkBar>
  );
}
