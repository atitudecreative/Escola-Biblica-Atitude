"use server";
import { refresh } from "next/cache";
import { runAction } from "@/server/action";
import { assertPermission } from "@/server/auth/guards";
import { gradeAttempt, gradeSubmission } from "@/server/services/grading";

export async function gradeSubmissionAction(input: unknown) {
  return runAction(
    "grading.submission",
    async () => {
      const user = await assertPermission("grading.own", "courses.manage_any");
      await gradeSubmission(user, input);
      refresh();
    },
    "Correção registrada e aluno notificado.",
  );
}

export async function gradeAttemptAction(input: unknown) {
  return runAction(
    "grading.attempt",
    async () => {
      const user = await assertPermission("grading.own", "courses.manage_any");
      const r = await gradeAttempt(user, input);
      refresh();
      return r;
    },
    "Avaliação corrigida e aluno notificado.",
  );
}
