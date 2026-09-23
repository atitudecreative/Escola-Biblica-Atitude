"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { quickCreateLessonAction } from "@/app/(app)/teacher/actions";
import { LESSON_TYPE } from "@/lib/labels";
import { LESSON_TYPES } from "@/lib/validation/teacher";

type CourseOpt = { id: string; title: string; modules: { id: string; title: string }[] };

/** Atalho "Nova aula" / "Nova atividade": escolhe curso e módulo e abre o editor da aula. */
export function QuickLessonDialog({
  courses,
  kind,
  trigger,
}: {
  courses: CourseOpt[];
  kind: "lesson" | "assignment";
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === courseId);
  const [moduleId, setModuleId] = useState(course?.modules.at(-1)?.id ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof LESSON_TYPES)[number]>(kind === "assignment" ? "ASSIGNMENT" : "VIDEO");
  const { run, pending, error, fieldErrors } = useAction(quickCreateLessonAction);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ courseId, moduleId: moduleId || null, title, type });
    if (res?.ok) {
      toast.success(kind === "assignment" ? "Atividade criada" : "Aula criada", { description: "Complete o conteúdo no editor." });
      setOpen(false);
      router.push(`/teacher/courses/${res.data.courseId}/lessons/${res.data.lessonId}`);
    }
  }

  const label = kind === "assignment" ? "Nova atividade" : "Nova aula";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={label}
        description={kind === "assignment" ? "A atividade é uma aula do tipo entrega, com prazo e nota." : "Escolha onde a aula vai ficar. Você completa o conteúdo em seguida."}
        footer={
          courses.length ? (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" form={`quick-${kind}`} loading={pending}>
                Criar e abrir editor
              </Button>
            </>
          ) : undefined
        }
      >
        {courses.length === 0 ? (
          <div className="flex flex-col gap-4">
            <Alert tone="info">Crie um curso antes de adicionar aulas.</Alert>
            <Button asChild>
              <Link href="/teacher/courses/new">Criar curso</Link>
            </Button>
          </div>
        ) : (
          <form id={`quick-${kind}`} onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Curso" required error={fieldErrors.courseId}>
                <NativeSelect
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setModuleId(courses.find((c) => c.id === e.target.value)?.modules.at(-1)?.id ?? "");
                  }}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Módulo" error={fieldErrors.moduleId} hint={course?.modules.length ? undefined : "Um módulo será criado automaticamente."}>
                <NativeSelect value={moduleId} onChange={(e) => setModuleId(e.target.value)} disabled={!course?.modules.length}>
                  {course?.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Título" required error={fieldErrors.title}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={kind === "assignment" ? "Ex.: Estudo dirigido de Romanos 8" : "Ex.: A aliança com Abraão"} autoFocus />
            </Field>
            {kind === "lesson" && (
              <Field label="Tipo de aula">
                <NativeSelect value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                  {LESSON_TYPES.filter((t) => t !== "ASSIGNMENT").map((t) => (
                    <option key={t} value={t}>
                      {LESSON_TYPE[t]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
