import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EyeOff, FileText, HelpCircle, Link2, Lock, MessageSquare, MessagesSquare } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getLearnData } from "@/server/services/learn-page";
import { createMediaToken } from "@/server/media-token";
import { getSettings } from "@/server/settings";
import { LearnShell } from "@/components/learn/learn-shell";
import { AudioLesson, CompleteBar, DocumentLesson, LinkLesson, VideoLesson } from "@/components/learn/lesson-media";
import { QuizRunner } from "@/components/learn/quiz-runner";
import { AssignmentPanel } from "@/components/learn/assignment-panel";
import { LessonComments } from "@/components/learn/lesson-comments";
import { FavoriteButton } from "@/components/course/course-actions";
import { Markdown } from "@/components/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LESSON_TYPE } from "@/lib/labels";
import { formatBytes, formatDuration } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false } };

export default async function LessonPage({ params }: PageProps<"/learn/[courseId]/[lessonId]">) {
  const { courseId, lessonId } = await params;
  const user = await requireUserPage();
  const [data, general] = await Promise.all([getLearnData(user, courseId, lessonId), getSettings("general")]);
  if (data.status === "not_found") notFound();
  if (data.status !== "ok") redirect(`/courses/${data.slug}?acesso=${data.status}`);

  const { course, lesson, next, prev } = data;
  const fileUrl = lesson.mediaFile ? `/api/files/${lesson.mediaFile.id}` : null;
  // Vídeo enviado: endereço pessoal, temporário e que só toca dentro do player (ver /api/stream).
  const videoSrc =
    lesson.videoProvider === "UPLOAD"
      ? lesson.mediaFile && !data.isLocked
        ? `/api/stream/${createMediaToken(lesson.mediaFile.id, user.id)}`
        : null
      : lesson.videoUrl;
  const enrolled = data.enrolled;
  const canModerate = data.manager || user.permissions.has("courses.manage_any");
  const nextInfo = next ? { id: next.id, title: next.title, locked: data.outline.flatMap((m) => m.lessons).find((l) => l.id === next.id)?.locked } : null;
  const complete = (label?: string) => (
    <CompleteBar lessonId={lesson.id} courseId={course.id} completed={data.completed} enrolled={enrolled} next={nextInfo} certificateEnabled={course.certificateEnabled} label={label} />
  );

  let main: React.ReactNode;
  if (data.isLocked) {
    main = (
      <EmptyState
        icon={Lock}
        title="Esta aula ainda está bloqueada"
        description="Este curso é sequencial: conclua as aulas anteriores para liberar esta."
        action={
          data.requiredBefore && (
            <Button asChild>
              <Link href={`/learn/${course.id}/${data.requiredBefore.id}`}>Ir para “{data.requiredBefore.title}”</Link>
            </Button>
          )
        }
      />
    );
  } else if (lesson.type === "VIDEO" && videoSrc && lesson.videoProvider) {
    main = (
      <VideoLesson
        lessonId={lesson.id}
        courseId={course.id}
        title={lesson.title}
        src={videoSrc}
        provider={lesson.videoProvider}
        captionsUrl={lesson.captionsUrl}
        resumeAt={data.resumeAt}
        completed={data.completed}
        enrolled={enrolled}
        next={nextInfo}
        certificateEnabled={course.certificateEnabled}
        watchedSegments={data.watchedSegments}
        durationSeconds={Math.max(lesson.durationSeconds, data.mediaSeconds)}
        watermark={`${user.name} · ${user.email}`}
      />
    );
  } else if (lesson.type === "QUIZ" && data.quiz) {
    main = <QuizRunner state={data.quiz} enrolled={enrolled} />;
  } else if (lesson.type === "ASSIGNMENT" && data.assignment) {
    main = <AssignmentPanel state={data.assignment} enrolled={enrolled} />;
  } else if (lesson.type === "AUDIO" && fileUrl) {
    main = (
      <div className="space-y-4">
        <AudioLesson lessonId={lesson.id} src={fileUrl} enrolled={enrolled} />
        {complete()}
      </div>
    );
  } else if ((lesson.type === "PDF" || lesson.type === "PRESENTATION" || lesson.type === "FILE") && lesson.mediaFile) {
    main = (
      <div className="space-y-4">
        <DocumentLesson file={lesson.mediaFile} inlinePdf={lesson.mediaFile.mimeType === "application/pdf"} />
        {complete("Marcar como lida")}
      </div>
    );
  } else if (lesson.type === "LINK" && lesson.externalUrl) {
    main = (
      <div className="space-y-4">
        <LinkLesson url={lesson.externalUrl} />
        {complete()}
      </div>
    );
  } else if (lesson.type === "TEXT") {
    main = (
      <div className="space-y-8">
        <article className="rounded-xl border border-border bg-surface px-5 py-6 sm:px-10 sm:py-10">
          <Markdown className="mx-auto max-w-[68ch] text-[1rem]">{lesson.content || "Conteúdo em preparação."}</Markdown>
        </article>
        {complete("Marcar como lida")}
      </div>
    );
  } else {
    main = <EmptyState icon={FileText} title="Conteúdo em preparação" description="O professor ainda não adicionou o conteúdo desta aula." />;
  }

  const showOverview = lesson.type !== "TEXT" && (lesson.summary || lesson.content);
  const commentCount = data.comments.length;

  return (
    <LearnShell
      brand={{ name: general.platformName, logoUrl: general.logoUrl }}
      course={{ id: course.id, slug: course.slug, title: course.title }}
      lessonId={lesson.id}
      outline={data.outline}
      totals={data.totals}
      prev={prev}
      next={next}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        {data.manager && !enrolled && (
          <Alert tone="info" className="mb-5">Você está visualizando como gestor do curso — o progresso não é registrado.</Alert>
        )}
        {!lesson.isPublished && (
          <Alert tone="warning" className="mb-5"><EyeOff className="mr-1 inline size-4" /> Aula não publicada — visível apenas para gestores do curso.</Alert>
        )}
        {!enrolled && !data.manager && (
          <Alert tone="info" className="mb-5" action={<Button asChild size="sm"><Link href={`/courses/${course.slug}`}>Matricular-se</Link></Button>}>
            Esta é uma aula de prévia gratuita.
          </Alert>
        )}

        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-caption text-subtle">
              {lesson.module.title} · {LESSON_TYPE[lesson.type]} · {formatDuration(lesson.durationSeconds)}
            </p>
            <h1 className="mt-1 text-h1 text-balance">{lesson.title}</h1>
          </div>
          <FavoriteButton type="LESSON" id={lesson.id} initial={data.isFavorite} label={false} variant="ghost" />
        </div>

        {main}

        <Tabs defaultValue={showOverview ? "overview" : "materials"} className="mt-10">
          <TabsList>
            {showOverview && <TabsTrigger value="overview">Visão geral</TabsTrigger>}
            <TabsTrigger value="materials">Materiais{lesson.materials.length ? ` (${lesson.materials.length})` : ""}</TabsTrigger>
            <TabsTrigger value="comments" id="comentarios">Comentários{commentCount ? ` (${commentCount})` : ""}</TabsTrigger>
            <TabsTrigger value="questions">Dúvidas</TabsTrigger>
          </TabsList>
          {showOverview && (
            <TabsContent value="overview">
              {lesson.summary && <p className="mb-4 text-[0.9375rem] text-muted">{lesson.summary}</p>}
              {lesson.content && <Markdown className="max-w-[72ch]">{lesson.content}</Markdown>}
            </TabsContent>
          )}
          <TabsContent value="materials">
            {lesson.materials.length === 0 ? (
              <p className="py-6 text-small text-muted">
                Esta aula não tem materiais próprios. Veja os{" "}
                <Link href={`/courses/${course.slug}#materiais`} className="text-primary hover:underline">materiais gerais do curso</Link>.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {lesson.materials.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      {m.kind === "LINK" ? <Link2 className="size-4" /> : <FileText className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="text-caption text-subtle">
                        {m.kind === "LINK" ? "Link externo" : `${m.file?.mimeType.split("/").pop()?.toUpperCase()} · ${formatBytes(m.file?.sizeBytes ?? 0)}`}
                      </p>
                    </div>
                    <FavoriteButton type="MATERIAL" id={m.id} initial={data.favoriteMaterials.has(m.id)} label={false} variant="ghost" />
                    {m.kind === "LINK" && m.url ? (
                      <Button asChild variant="outline" size="sm"><a href={m.url} target="_blank" rel="noopener noreferrer nofollow">Abrir</a></Button>
                    ) : m.file ? (
                      <div className="flex gap-1">
                        {/^(application\/pdf|image\/)/.test(m.file.mimeType) && (
                          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><a href={`/api/files/${m.file.id}`} target="_blank" rel="noopener">Visualizar</a></Button>
                        )}
                        <Button asChild variant="outline" size="sm"><a href={`/api/files/${m.file.id}?download=1`}>Baixar</a></Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="comments">
            <LessonComments lessonId={lesson.id} comments={data.comments} me={user.id} canModerate={canModerate} canPost={enrolled || data.manager} />
          </TabsContent>
          <TabsContent value="questions">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href={`/messages?to=${course.instructor.id}`} className="group rounded-xl border border-border bg-surface p-5 transition hover:border-border-strong">
                <MessageSquare className="size-5 text-primary" />
                <p className="mt-3 text-h4 group-hover:text-primary">Perguntar ao professor</p>
                <p className="mt-1 text-small text-muted">Envie uma mensagem privada para {course.instructor.name}.</p>
              </Link>
              <Link href="/community/new?type=QUESTION" className="group rounded-xl border border-border bg-surface p-5 transition hover:border-border-strong">
                <MessagesSquare className="size-5 text-primary" />
                <p className="mt-3 text-h4 group-hover:text-primary">Perguntar à comunidade</p>
                <p className="mt-1 text-small text-muted">Outros alunos e monitores podem ajudar — e a resposta fica para todos.</p>
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-caption text-subtle"><HelpCircle className="size-3.5" /> Dúvidas técnicas? Fale com o suporte em Mensagens.</p>
          </TabsContent>
        </Tabs>
      </div>
    </LearnShell>
  );
}
