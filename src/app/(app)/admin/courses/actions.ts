"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import * as svc from "@/server/services/admin-courses";

const id = z.string().min(1).max(40);

function done() {
  revalidatePath("/admin/courses");
  revalidatePath("/", "layout");
}

export async function approveCourseAction(courseId: string) {
  return runAction(
    "admin.course.approve",
    async () => {
      await svc.approveCourse(parseInput(id, courseId));
      done();
    },
    "Curso aprovado e publicado. O professor foi avisado.",
  );
}

export async function returnCourseAction(input: unknown) {
  return runAction(
    "admin.course.return",
    async () => {
      const d = parseInput(
        z.object({ id, comment: z.string().trim().min(10, "Explique o que precisa ser ajustado (mínimo de 10 caracteres)").max(1000) }),
        input,
      );
      await svc.returnCourse(d.id, d.comment);
      done();
    },
    "Curso devolvido ao professor com seu comentário.",
  );
}

export async function bulkCourseAction(input: unknown) {
  return runAction("admin.course.bulk", async () => {
    const d = parseInput(z.object({ ids: z.array(id).min(1).max(100), action: z.enum(["publish", "archive"]) }), input);
    const r = await svc.bulkCourseStatus(d.ids, d.action);
    done();
    return r;
  });
}

export async function featureCourseAction(input: unknown) {
  return runAction("admin.course.feature", async () => {
    const d = parseInput(z.object({ id, featured: z.boolean() }), input);
    await svc.setCourseFeatured(d.id, d.featured);
    done();
    return d.featured;
  });
}

export async function changeInstructorAction(input: unknown) {
  return runAction(
    "admin.course.instructor",
    async () => {
      const d = parseInput(z.object({ id, instructorId: z.string().min(1, "Escolha um professor").max(40) }), input);
      await svc.changeCourseInstructor(d.id, d.instructorId);
      done();
    },
    "Professor responsável atualizado.",
  );
}
