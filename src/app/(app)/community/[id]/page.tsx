import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { CheckCircle2, Eye, Lock, MessageSquare, Pin } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { getThread, registerView } from "@/server/services/community";
import { NotFoundError } from "@/server/errors";
import { db } from "@/server/db";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Markdown } from "@/components/markdown";
import { LikeButton, ReplyForm, ReplyMenu, SolutionButton, ThreadMenu } from "@/components/community/thread-controls";
import { clock, dayLabel, fullDateTime, relative } from "@/components/communication/time";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoleKey } from "@/lib/permissions";

export async function generateMetadata({ params }: PageProps<"/community/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await db.discussionThread.findFirst({ where: { id, deletedAt: null }, select: { title: true } });
  return { title: t?.title ?? "Discussão" };
}

function roleBadge(roles: { role: { key: string } }[]) {
  const keys = roles.map((r) => r.role.key as RoleKey);
  if (keys.includes("teacher")) return { label: "Professor", tone: "primary" as const };
  if (keys.includes("admin") || keys.includes("manager")) return { label: "Equipe", tone: "accent" as const };
  return null;
}

function When({ d }: { d: Date }) {
  return (
    <time dateTime={d.toISOString()} title={fullDateTime(d)} suppressHydrationWarning>
      {relative(d)}
    </time>
  );
}

export default async function ThreadPage({ params }: PageProps<"/community/[id]">) {
  const user = await requirePermissionPage("community.participate", "community.moderate");
  const { id } = await params;
  const data = await getThread(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { thread, likedThread, likedReplies, mutedUntil } = data;
  // Contagem de visualização fora do caminho crítico da renderização.
  after(() => registerView(user.id, thread.id).catch(() => undefined));

  const canModerate = user.permissions.has("community.moderate");
  const canMute = user.permissions.has("users.manage");
  const isAuthor = thread.authorId === user.id;
  const isQuestion = thread.type === "QUESTION";
  const canChooseSolution = isQuestion && (isAuthor || canModerate);
  const solution = thread.replies.find((r) => r.id === thread.solutionReplyId) ?? null;
  const authorBadge = roleBadge(thread.author.roles);
  const listHref = isQuestion ? "/community/questions" : "/community";

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "Comunidade", href: "/community" },
          { label: isQuestion ? "Perguntas" : "Discussões", href: listHref },
          { label: thread.title },
        ]}
      />

      <article aria-labelledby="thread-title">
        <div className="flex flex-wrap items-center gap-1.5">
          {thread.isPinned && (
            <Badge tone="accent">
              <Pin /> Fixada
            </Badge>
          )}
          {isQuestion && <Badge tone={solution ? "success" : "info"}>{solution ? <><CheckCircle2 /> Resolvida</> : "Pergunta"}</Badge>}
          {!isQuestion && <Badge>Discussão</Badge>}
          {thread.isLocked && (
            <Badge>
              <Lock /> Trancada
            </Badge>
          )}
          {thread.course && (
            <Link href={`/community?course=${thread.course.id}`} className="ml-1 text-caption font-medium text-muted hover:text-fg hover:underline">
              {thread.course.title}
            </Link>
          )}
        </div>
        <div className="mt-3 flex items-start gap-3">
          <h1 id="thread-title" className="min-w-0 flex-1 text-h1 text-balance text-fg">
            {thread.title}
          </h1>
          <ThreadMenu
            threadId={thread.id}
            isPinned={thread.isPinned}
            isLocked={thread.isLocked}
            canModerate={canModerate}
            isAuthor={isAuthor}
            canMute={canMute}
            author={{ id: thread.author.id, name: thread.author.name, mutedUntil: thread.author.communityMutedUntil?.toISOString() ?? null }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Avatar name={thread.author.name} src={thread.author.avatarUrl} size="sm" />
          <div className="min-w-0 text-small">
            <p className="flex flex-wrap items-center gap-x-1.5">
              <span className="font-medium text-fg">{thread.author.name}</span>
              {authorBadge && <Badge tone={authorBadge.tone} className="h-5 px-2">{authorBadge.label}</Badge>}
            </p>
            <p className="text-caption text-subtle">
              <span suppressHydrationWarning>
                {dayLabel(thread.createdAt)} às {clock(thread.createdAt)}
              </span>
              <span aria-hidden> · </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="size-3" aria-hidden /> {formatNumber(thread.viewCount)} visualizações
              </span>
            </p>
          </div>
        </div>

        <Markdown className="mt-6">{thread.body}</Markdown>

        <div className="mt-6 flex items-center gap-2 border-y border-border py-2">
          <LikeButton target={{ threadId: thread.id }} liked={likedThread} count={thread.likeCount} />
          <a href="#responder" className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-small font-medium text-muted hover:bg-surface-2 hover:text-fg">
            <MessageSquare className="size-4" aria-hidden /> {thread.replies.length} {thread.replies.length === 1 ? "resposta" : "respostas"}
          </a>
        </div>
      </article>

      {solution && (
        <a
          href={`#r-${solution.id}`}
          className="mt-6 block rounded-xl border border-success/30 bg-success-soft/60 px-4 py-3 transition-colors hover:bg-success-soft"
        >
          <p className="flex items-center gap-1.5 text-small font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden /> Resposta aceita · {solution.author.name}
          </p>
          <p className="mt-1 line-clamp-2 text-small text-fg/80">{solution.body.replace(/[#*_>`[\]]/g, "")}</p>
        </a>
      )}

      <section aria-labelledby="respostas" className="mt-8">
        <h2 id="respostas" className="mb-4 text-h3 text-fg">
          {thread.replies.length ? `${thread.replies.length} ${thread.replies.length === 1 ? "resposta" : "respostas"}` : "Respostas"}
        </h2>
        {thread.replies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong px-6 py-10 text-center">
            <MessageSquare className="mx-auto size-5 text-subtle" aria-hidden />
            <p className="mt-2 text-sm font-medium text-fg">{isQuestion ? "Ainda sem respostas" : "Ninguém comentou ainda"}</p>
            <p className="mt-1 text-small text-muted">{isQuestion ? "Sabe a resposta? Ajude um colega logo abaixo." : "Comece a conversa logo abaixo."}</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {thread.replies.map((r) => {
              const isSolution = r.id === thread.solutionReplyId;
              const badge = roleBadge(r.author.roles);
              return (
                <li
                  key={r.id}
                  id={`r-${r.id}`}
                  className={cn(
                    "scroll-mt-24 rounded-xl border bg-surface px-4 py-4 target:ring-2 target:ring-primary sm:px-5",
                    isSolution ? "border-success/40 ring-1 ring-success/30" : "border-border",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={r.author.name} src={r.author.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
                        <span className="font-medium text-fg">{r.author.name}</span>
                        {badge && <Badge tone={badge.tone} className="h-5 px-2">{badge.label}</Badge>}
                        {r.authorId === thread.authorId && <Badge className="h-5 px-2">Autor</Badge>}
                        <span className="text-caption text-subtle">
                          <When d={r.createdAt} />
                        </span>
                        {isSolution && (
                          <Badge tone="success" className="h-5 px-2">
                            <CheckCircle2 /> Solução
                          </Badge>
                        )}
                      </div>
                      <Markdown className="mt-2 text-[0.9375rem]">{r.body}</Markdown>
                      <div className="mt-2 -ml-2.5 flex flex-wrap items-center gap-1">
                        <LikeButton target={{ replyId: r.id }} liked={likedReplies.has(r.id)} count={r.likeCount} />
                        {canChooseSolution && <SolutionButton threadId={thread.id} replyId={r.id} isSolution={isSolution} />}
                        <div className="ml-auto">
                          <ReplyMenu
                            replyId={r.id}
                            canModerate={canModerate}
                            isAuthor={r.authorId === user.id}
                            canMute={canMute}
                            author={{ id: r.author.id, name: r.author.name, mutedUntil: r.author.communityMutedUntil?.toISOString() ?? null }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section id="responder" aria-labelledby="responder-title" className="mt-8 scroll-mt-24">
        <h2 id="responder-title" className="mb-3 text-h4 text-fg">
          Sua resposta
        </h2>
        {mutedUntil ? (
          <Alert tone="warning" title="Participação suspensa">
            Você pode ler, mas só poderá responder a partir de {formatDateTime(mutedUntil)}.
          </Alert>
        ) : thread.isLocked && !canModerate ? (
          <Alert tone="info" title="Discussão trancada">
            Esta discussão não aceita novas respostas.
          </Alert>
        ) : (
          <>
            {thread.isLocked && (
              <Alert tone="info" className="mb-3">
                Discussão trancada. Como moderador, você ainda pode responder.
              </Alert>
            )}
            <ReplyForm threadId={thread.id} placeholder={isQuestion ? "Compartilhe o que você sabe. Cite referências bíblicas quando puder." : "Escreva sua resposta…"} />
          </>
        )}
      </section>
    </div>
  );
}
