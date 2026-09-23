import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getLessonForEdit } from "@/server/services/course-builder";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LessonEditor, MaterialsEditor } from "@/components/teacher/lesson-editor";
import { LessonActions } from "@/components/teacher/lesson-actions";
import { QuizEditor } from "@/components/teacher/quiz-editor";
import { AssignmentEditor } from "@/components/teacher/assignment-editor";
import { LESSON_TYPE } from "@/lib/labels";

export async function generateMetadata(props: PageProps<"/teacher/courses/[id]/lessons/[lessonId]">): Promise<Metadata> {
  const { lessonId } = await props.params;
  const l = await db.lesson.findUnique({ where: { id: lessonId }, select: { title: true } });
  return { title: l ? `${l.title} · Editor de aula` : "Aula" };
}

export default async function LessonEditPage(props: PageProps<"/teacher/courses/[id]/lessons/[lessonId]">) {
  const user = await requirePermissionPage("courses.manage_own", "courses.manage_any");
  const { id, lessonId } = await props.params;
  let lesson;
  try {
    lesson = await getLessonForEdit(user, id, lessonId);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) notFound();
    throw e;
  }

  // Navegação entre aulas na ordem do currículo.
  const order = await db.module.findMany({
    where: { courseId: id },
    orderBy: { position: "asc" },
    select: { lessons: { orderBy: { position: "asc" }, select: { id: true, title: true } } },
  });
  const flat = order.flatMap((m) => m.lessons);
  const idx = flat.findIndex((l) => l.id === lesson.id);
  const prev = flat[idx - 1];
  const next = flat[idx + 1];

  const pendingSubs = lesson.assignment
    ? await db.assignmentSubmission.count({ where: { assignmentId: lesson.assignment.id, status: { in: ["SUBMITTED", "GRADING"] } } })
    : 0;
  const hasResponses = (lesson.quiz?._count.attempts ?? 0) > 0 || (lesson.assignment?._count.submissions ?? 0) > 0;
  const coursePublished = lesson.course.status === "PUBLISHED";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Meus cursos", href: "/teacher/courses" },
          { label: lesson.course.title, href: `/teacher/courses/${id}` },
          { label: lesson.module.title, href: `/teacher/courses/${id}` },
          { label: lesson.title },
        ]}
        title={lesson.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{LESSON_TYPE[lesson.type]}</Badge>
            {lesson.isPublished ? <Badge tone="success" dot>Publicada</Badge> : <Badge dot>Rascunho</Badge>}
            {lesson.isPreview && <Badge tone="accent">Prévia gratuita</Badge>}
            <span className="text-caption text-subtle">Aula {idx + 1} de {flat.length}</span>
          </span>
        }
        actions={<LessonActions lessonId={lesson.id} courseId={id} isPublished={lesson.isPublished} coursePublished={coursePublished} />}
      />

      {!lesson.isPublished && coursePublished && (
        <Alert tone="info" className="mb-6">
          Esta aula é um rascunho: os alunos ainda não a veem. Ao publicar, os matriculados recebem uma notificação.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {lesson.type === "QUIZ" && lesson.quiz && (
            <QuizEditor
              lessonId={lesson.id}
              attempts={lesson.quiz._count.attempts}
              settings={{
                passingScore: lesson.quiz.passingScore,
                maxAttempts: lesson.quiz.maxAttempts,
                shuffleQuestions: lesson.quiz.shuffleQuestions,
                timeLimitMinutes: lesson.quiz.timeLimitMinutes,
                feedbackMode: lesson.quiz.feedbackMode,
                requiredToComplete: lesson.quiz.requiredToComplete,
              }}
              questions={lesson.quiz.questions.map((q) => ({
                id: q.id,
                type: q.type,
                prompt: q.prompt,
                explanation: q.explanation,
                points: q.points,
                acceptedAnswers: q.acceptedAnswers,
                options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
              }))}
            />
          )}
          {lesson.type === "ASSIGNMENT" && lesson.assignment && (
            <AssignmentEditor
              lessonId={lesson.id}
              courseId={id}
              submissions={lesson.assignment._count.submissions}
              pending={pendingSubs}
              initial={{
                instructions: lesson.assignment.instructions,
                dueAt: lesson.assignment.dueAt?.toISOString() ?? null,
                maxScore: lesson.assignment.maxScore,
                passingScore: lesson.assignment.passingScore,
                allowText: lesson.assignment.allowText,
                allowFile: lesson.assignment.allowFile,
              }}
            />
          )}
          <LessonEditor
            hasResponses={hasResponses}
            mediaFile={lesson.mediaFile ? { id: lesson.mediaFile.id, name: lesson.mediaFile.originalName, mimeType: lesson.mediaFile.mimeType, sizeBytes: lesson.mediaFile.sizeBytes } : null}
            initial={{
              lessonId: lesson.id,
              title: lesson.title,
              summary: lesson.summary ?? "",
              type: lesson.type,
              content: lesson.content,
              videoProvider: lesson.videoProvider ?? "YOUTUBE",
              videoUrl: lesson.videoUrl ?? "",
              captionsUrl: lesson.captionsUrl ?? "",
              externalUrl: lesson.externalUrl ?? "",
              mediaFileId: lesson.mediaFileId ?? "",
              durationMinutes: Math.floor(lesson.durationSeconds / 60),
              durationSecondsPart: lesson.durationSeconds % 60,
              isPreview: lesson.isPreview,
            }}
          />
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <MaterialsEditor
            lessonId={lesson.id}
            materials={lesson.materials.map((m) => ({ id: m.id, title: m.title, kind: m.kind, url: m.url, fileId: m.fileId, file: m.file }))}
          />
          <nav aria-label="Outras aulas" className="grid grid-cols-2 gap-2">
            {prev ? (
              <Link href={`/teacher/courses/${id}/lessons/${prev.id}`} className="flex min-h-14 flex-col justify-center rounded-lg border border-border px-3 py-2 hover:bg-surface-2">
                <span className="flex items-center gap-1 text-caption text-subtle"><ChevronLeft className="size-3.5" /> Anterior</span>
                <span className="truncate text-small font-medium">{prev.title}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/teacher/courses/${id}/lessons/${next.id}`} className="flex min-h-14 flex-col items-end justify-center rounded-lg border border-border px-3 py-2 text-right hover:bg-surface-2">
                <span className="flex items-center gap-1 text-caption text-subtle">Próxima <ChevronRight className="size-3.5" /></span>
                <span className="w-full truncate text-small font-medium">{next.title}</span>
              </Link>
            ) : <span />}
          </nav>
        </aside>
      </div>
    </>
  );
}
