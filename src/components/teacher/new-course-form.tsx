"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useAction } from "@/hooks/use-action";
import { createCourseAction } from "@/app/(app)/teacher/courses/new/actions";
import { COURSE_LEVEL } from "@/lib/labels";
import { COURSE_LEVELS, newCourseSchema } from "@/lib/validation/teacher";
import { slugify } from "@/lib/utils";

export function NewCourseForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [level, setLevel] = useState<(typeof COURSE_LEVELS)[number]>("BEGINNER");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const { run, pending, error, fieldErrors } = useAction(createCourseAction);
  const errors = { ...fieldErrors, ...clientErrors };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { title, subtitle, categoryId: categoryId || null, level };
    const parsed = newCourseSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setClientErrors(errs);
      return;
    }
    setClientErrors({});
    run(input);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
      <Field label="Título do curso" required error={errors.title} hint={title ? `Endereço sugerido: /courses/${slugify(title) || "…"}` : "Você pode alterar depois."}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: Panorama dos Evangelhos" autoFocus />
      </Field>
      <Field label="Subtítulo" error={errors.subtitle} hint="Uma frase que explica a promessa do curso.">
        <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={200} placeholder="Ex.: Conheça a vida e o ensino de Jesus em quatro perspectivas" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Categoria" error={errors.categoryId}>
          <NativeSelect value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Nível" error={errors.level}>
          <NativeSelect value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            {COURSE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {COURSE_LEVEL[l]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button variant="outline" asChild>
          <Link href="/teacher/courses">Cancelar</Link>
        </Button>
        <Button type="submit" loading={pending}>
          Criar rascunho
        </Button>
      </div>
    </form>
  );
}
