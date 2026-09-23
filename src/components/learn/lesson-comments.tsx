"use client";
import { useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { useAction } from "@/hooks/use-action";
import { deleteCommentAction, postCommentAction } from "@/app/learn/actions";
import { timeAgo } from "@/lib/format";

type Author = { id: string; name: string; avatarUrl: string | null; roles: { role: { key: string } }[] };
export type CommentData = { id: string; body: string; createdAt: Date; deletedAt: Date | null; user: Author; replies?: CommentData[] };

function isTeacher(a: Author) {
  return a.roles.some((r) => r.role.key === "teacher");
}

function Composer({ lessonId, parentId, onDone, autoFocus, placeholder }: { lessonId: string; parentId?: string; onDone?: () => void; autoFocus?: boolean; placeholder: string }) {
  const [body, setBody] = useState("");
  const { run, pending, fieldErrors } = useAction(postCommentAction, {
    errorToast: true,
    onSuccess: () => {
      setBody("");
      onDone?.();
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ lessonId, body, parentId: parentId ?? null });
      }}
      className="space-y-2"
    >
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} className="min-h-20" maxLength={2000} autoFocus={autoFocus} aria-label={placeholder} aria-invalid={!!fieldErrors.body} />
      {fieldErrors.body && <p className="text-caption text-danger">{fieldErrors.body}</p>}
      <div className="flex justify-end gap-2">
        {onDone && <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancelar</Button>}
        <Button type="submit" size="sm" loading={pending} disabled={body.trim().length < 2}>Publicar</Button>
      </div>
    </form>
  );
}

function CommentItem({ c, lessonId, me, canModerate, isReply }: { c: CommentData; lessonId: string; me: string; canModerate: boolean; isReply?: boolean }) {
  const [replying, setReplying] = useState(false);
  const confirm = useConfirm();
  const del = useAction(deleteCommentAction, { errorToast: true });
  return (
    <li className="flex gap-3">
      <Avatar name={c.user.name} src={c.user.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{c.user.name}</span>
          {isTeacher(c.user) && <Badge tone="primary">Professor</Badge>}
          <span className="text-caption text-subtle">{timeAgo(c.createdAt)}</span>
        </div>
        {c.deletedAt ? (
          <p className="mt-1 text-sm text-subtle italic">Comentário removido.</p>
        ) : (
          <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{c.body}</p>
        )}
        {!c.deletedAt && (
          <div className="mt-1 flex gap-1">
            {!isReply && (
              <Button variant="ghost" size="sm" className="-ml-2.5" onClick={() => setReplying((r) => !r)}>Responder</Button>
            )}
            {(c.user.id === me || canModerate) && (
              <Button
                variant="ghost"
                size="sm"
                className={isReply ? "-ml-2.5" : ""}
                onClick={async () => {
                  if (await confirm({ title: "Remover comentário?", confirmLabel: "Remover" })) del.run(c.id);
                }}
              >
                <Trash2 /> Remover
              </Button>
            )}
          </div>
        )}
        {replying && (
          <div className="mt-2">
            <Composer lessonId={lessonId} parentId={c.id} onDone={() => setReplying(false)} autoFocus placeholder="Escreva uma resposta" />
          </div>
        )}
        {!!c.replies?.length && (
          <ul className="mt-4 space-y-4 border-l border-border pl-4">
            {c.replies.map((r) => (
              <CommentItem key={r.id} c={r} lessonId={lessonId} me={me} canModerate={canModerate} isReply />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function LessonComments({ lessonId, comments, me, canModerate, canPost }: { lessonId: string; comments: CommentData[]; me: string; canModerate: boolean; canPost: boolean }) {
  return (
    <div className="space-y-6">
      {canPost && <Composer lessonId={lessonId} placeholder="Compartilhe uma reflexão ou anotação com a turma" />}
      {comments.length === 0 ? (
        <div className="py-8 text-center">
          <MessageSquare className="mx-auto size-5 text-subtle" />
          <p className="mt-2 text-small text-muted">Ninguém comentou ainda. Seja o primeiro a compartilhar!</p>
        </div>
      ) : (
        <ul className="space-y-6">
          {comments.map((c) => (
            <CommentItem key={c.id} c={c} lessonId={lessonId} me={me} canModerate={canModerate} />
          ))}
        </ul>
      )}
    </div>
  );
}
