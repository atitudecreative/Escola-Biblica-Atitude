"use client";
import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { sendAnnouncementAction } from "@/app/(app)/teacher/actions";
import { pluralize } from "@/lib/format";

type CourseOption = { id: string; title: string };

/** Comunicado para a turma de um curso: cria o Announcement e notifica os matriculados. */
export function AnnouncementDialog({
  courses,
  defaultCourseId,
  trigger,
}: {
  courses: CourseOption[];
  defaultCourseId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(defaultCourseId ?? courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { run, pending, error, fieldErrors } = useAction(sendAnnouncementAction, { successToast: false });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ audience: "COURSE", courseId, title, body });
    if (res?.ok) {
      toast.success("Comunicado enviado", { description: `${pluralize(res.data.recipients, "aluno notificado", "alunos notificados")}.` });
      setTitle("");
      setBody("");
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Megaphone /> Enviar comunicado
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title="Enviar comunicado"
        description="Os alunos matriculados recebem uma notificação e o comunicado fica disponível em Comunicados."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} type="button">
              Cancelar
            </Button>
            <Button type="submit" form="announcement-form" loading={pending} disabled={!courses.length}>
              Enviar comunicado
            </Button>
          </>
        }
      >
        {courses.length === 0 ? (
          <Alert tone="info">Você ainda não tem cursos com turma. Publique um curso para enviar comunicados.</Alert>
        ) : (
          <form id="announcement-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
            <Field label="Turma (curso)" error={fieldErrors.courseId} required>
              <NativeSelect value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Título" error={fieldErrors.title} required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Ex.: Aula ao vivo nesta quinta, às 20h" />
            </Field>
            <Field label="Mensagem" error={fieldErrors.body} hint={`${body.length}/5000`} required>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={5000} placeholder="Escreva o recado para a turma…" />
            </Field>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
