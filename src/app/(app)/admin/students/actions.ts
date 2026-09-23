"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import * as svc from "@/server/services/users-admin";

const id = z.string().min(1).max(40);

export async function enrollStudentAction(input: unknown) {
  return runAction("admin.student.enroll", async () => {
    const d = parseInput(z.object({ userId: id, courseId: z.string({ message: "Escolha um curso" }).min(1, "Escolha um curso").max(40) }), input);
    const res = await svc.enrollStudent(d.userId, d.courseId);
    revalidatePath("/admin/students", "layout");
    return res;
  });
}

export async function removeEnrollmentAction(enrollmentId: unknown) {
  return runAction(
    "admin.student.unenroll",
    async () => {
      await svc.removeEnrollment(parseInput(id, enrollmentId));
      revalidatePath("/admin/students", "layout");
    },
    "Matrícula removida.",
  );
}
