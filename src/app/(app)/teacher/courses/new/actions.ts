"use server";
import { redirect } from "next/navigation";
import { runAction } from "@/server/action";
import { assertPermission } from "@/server/auth/guards";
import { createCourse } from "@/server/services/course-builder";

export async function createCourseAction(input: unknown) {
  const result = await runAction("teacher.create_course", async () => {
    const user = await assertPermission("courses.create", "courses.manage_any");
    const course = await createCourse(user, input);
    return course.id;
  });
  if (result.ok) redirect(`/teacher/courses/${result.data}?created=1`);
  return result;
}
