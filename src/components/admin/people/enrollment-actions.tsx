"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { useAction } from "@/hooks/use-action";
import { enrollStudentAction, removeEnrollmentAction } from "@/app/(app)/admin/students/actions";

export function EnrollDialogButton({
  student,
  courses,
  size = "md",
  variant = "primary",
}: {
  student: { id: string; name: string };
  courses: { id: string; title: string; status: string }[];
  size?: "sm" | "md";
  variant?: "primary" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const router = useRouter();
  const { run, pending, error, fieldErrors } = useAction(enrollStudentAction, {
    onSuccess: (d) => {
      toast.success(`${student.name.split(" ")[0]} foi matriculado(a) em ${d.course}.`);
      setOpen(false);
      setCourseId("");
      router.refresh();
    },
  });
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <GraduationCap /> Matricular
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Matricular em um curso"
          description={`${student.name} receberá uma notificação e poderá começar imediatamente.`}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button loading={pending} disabled={!courseId} onClick={() => run({ userId: student.id, courseId })}>
                Confirmar matrícula
              </Button>
            </>
          }
        >
          {courses.length === 0 ? (
            <p className="text-sm text-muted">Este aluno já está matriculado em todos os cursos disponíveis.</p>
          ) : (
            <Field label="Curso" error={fieldErrors.courseId ?? (error && !Object.keys(fieldErrors).length ? error : undefined)}>
              <NativeSelect value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Escolha um curso…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.status !== "PUBLISHED" ? " (não publicado)" : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveEnrollmentButton({ enrollmentId, course, student }: { enrollmentId: string; course: string; student: string }) {
  const confirm = useConfirm();
  const router = useRouter();
  const { run, pending } = useAction(removeEnrollmentAction, { errorToast: true, onSuccess: () => router.refresh() });
  return (
    <Button
      size="sm"
      variant="danger-ghost"
      loading={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Remover matrícula em ${course}?`,
          description: `${student} perde o acesso ao curso. O progresso fica guardado e volta se a pessoa for matriculada de novo.`,
          confirmLabel: "Remover matrícula",
        });
        if (ok) run(enrollmentId);
      }}
    >
      <X /> Remover
    </Button>
  );
}
