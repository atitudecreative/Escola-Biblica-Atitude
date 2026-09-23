"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import { assertUser } from "@/server/auth/guards";
import * as cb from "@/server/services/course-builder";

/**
 * Actions do Course Builder. Finas: autenticam, delegam ao serviço (que valida
 * a entrada e verifica se o usuário gerencia o curso) e atualizam a tela.
 */
const idInput = z.object({ id: z.string().min(1).max(40) });
const toggleInput = z.object({ id: z.string().min(1).max(40), value: z.boolean() });

function act<T>(name: string, fn: (user: Awaited<ReturnType<typeof assertUser>>) => Promise<T>, message?: string) {
  return runAction(
    `builder.${name}`,
    async () => {
      const user = await assertUser();
      const out = await fn(user);
      refresh();
      return out;
    },
    message,
  );
}

// Curso
export async function updateDetailsAction(input: unknown) {
  return act("details", (u) => cb.updateCourseDetails(u, input), "Detalhes salvos.");
}
export async function updateSettingsAction(input: unknown) {
  return act("settings", (u) => cb.updateCourseSettings(u, input), "Configurações salvas.");
}
export async function publishAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("publish", async (u) => {
    const status = await cb.publishOrSubmit(u, id);
    return status;
  });
}
export async function returnToDraftAction(input: unknown) {
  const data = parseInput(z.object({ id: z.string().min(1).max(40), reason: z.string().trim().max(500).optional() }), input);
  return act("return_draft", (u) => cb.returnToDraft(u, data.id, data.reason), "O curso voltou para rascunho.");
}
export async function archiveAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("archive", (u) => cb.archiveCourse(u, id), "Curso arquivado. Alunos matriculados mantêm o acesso.");
}
export async function restoreAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("restore", (u) => cb.restoreCourse(u, id));
}
export async function deleteCourseAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  const res = await runAction("builder.delete_course", async () => {
    const user = await assertUser();
    await cb.deleteDraftCourse(user, id);
  });
  if (res.ok) redirect("/teacher/courses?deleted=1");
  return res;
}

// Módulos
export async function createModuleAction(input: unknown) {
  return act("module_create", async (u) => (await cb.createModule(u, input)).id, "Módulo criado.");
}
export async function renameModuleAction(input: unknown) {
  return act("module_rename", (u) => cb.renameModule(u, input), "Módulo atualizado.");
}
export async function duplicateModuleAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("module_duplicate", async (u) => (await cb.duplicateModule(u, id)).id, "Módulo duplicado.");
}
export async function deleteModuleAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("module_delete", (u) => cb.deleteModule(u, id), "Módulo excluído.");
}
export async function reorderAction(input: unknown) {
  return act("reorder", (u) => cb.reorderCurriculum(u, input));
}

// Aulas
export async function createLessonAction(input: unknown) {
  return act("lesson_create", async (u) => (await cb.createLesson(u, input)).id, "Aula criada.");
}
export async function duplicateLessonAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("lesson_duplicate", async (u) => (await cb.duplicateLesson(u, id)).id, "Aula duplicada.");
}
export async function deleteLessonAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("lesson_delete", (u) => cb.deleteLesson(u, id), "Aula excluída.");
}
export async function publishLessonAction(input: unknown) {
  const { id, value } = parseInput(toggleInput, input);
  return act("lesson_publish", (u) => cb.setLessonPublished(u, id, value), value ? "Aula publicada." : "Aula despublicada.");
}
export async function previewLessonAction(input: unknown) {
  const { id, value } = parseInput(toggleInput, input);
  return act("lesson_preview", (u) => cb.setLessonPreview(u, id, value), value ? "Aula liberada como prévia gratuita." : "Prévia gratuita removida.");
}
export async function updateLessonAction(input: unknown) {
  return act("lesson_update", async (u) => (await cb.updateLesson(u, input)).id, "Aula salva.");
}

// Materiais
export async function addMaterialAction(input: unknown) {
  return act("material_add", async (u) => (await cb.addMaterial(u, input)).id, "Material adicionado.");
}
export async function removeMaterialAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("material_remove", (u) => cb.removeMaterial(u, id), "Material removido.");
}

// Questionário
export async function updateQuizSettingsAction(input: unknown) {
  return act("quiz_settings", (u) => cb.updateQuizSettings(u, input), "Configurações do questionário salvas.");
}
export async function saveQuestionAction(input: unknown) {
  return act("question_save", (u) => cb.saveQuestion(u, input), "Questão salva.");
}
export async function deleteQuestionAction(input: unknown) {
  const { id } = parseInput(idInput, input);
  return act("question_delete", (u) => cb.deleteQuestion(u, id), "Questão excluída.");
}
export async function moveQuestionAction(input: unknown) {
  const data = parseInput(z.object({ id: z.string().min(1).max(40), direction: z.enum(["up", "down"]) }), input);
  return act("question_move", (u) => cb.moveQuestion(u, data.id, data.direction));
}

// Atividade
export async function updateAssignmentAction(input: unknown) {
  return act("assignment_update", (u) => cb.updateAssignment(u, input), "Atividade salva.");
}
