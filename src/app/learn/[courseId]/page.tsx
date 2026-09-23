import { notFound, redirect } from "next/navigation";
import { requireUserPage } from "@/server/auth/guards";
import { nextLessonFor, orderedLessons } from "@/server/services/learning";

/** /learn/:courseId → retoma de onde parou. */
export default async function ResumeCourse({ params }: PageProps<"/learn/[courseId]">) {
  const { courseId } = await params;
  const user = await requireUserPage();
  const next = (await nextLessonFor(user.id, courseId)) ?? (await orderedLessons(courseId))[0]?.id;
  if (!next) notFound();
  redirect(`/learn/${courseId}/${next}`);
}
