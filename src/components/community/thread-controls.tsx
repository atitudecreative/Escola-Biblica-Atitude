"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Heart, Lock, LockOpen, MoreHorizontal, Pin, PinOff, ShieldBan, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MarkdownEditor } from "@/components/communication/markdown-editor";
import {
  moderateThreadAction,
  muteUserAction,
  removeReplyAction,
  replyAction,
  setSolutionAction,
  toggleLikeAction,
} from "@/app/(app)/community/actions";

/** Curtida otimista: muda na hora e reconcilia com o contador do servidor. */
export function LikeButton({
  target,
  liked: initialLiked,
  count: initialCount,
  disabled,
}: {
  target: { threadId: string } | { replyId: string };
  liked: boolean;
  count: number;
  disabled?: boolean;
}) {
  const [state, setState] = useState({ liked: initialLiked, count: initialCount });
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const prev = state;
    setState({ liked: !prev.liked, count: Math.max(0, prev.count + (prev.liked ? -1 : 1)) });
    setBusy(true);
    const res = await toggleLikeAction(target);
    setBusy(false);
    if (res.ok) setState(res.data);
    else {
      setState(prev);
      toast.error(res.error);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={state.liked}
      aria-label={state.liked ? "Remover curtida" : "Curtir"}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-small font-medium transition-colors disabled:opacity-50",
        state.liked ? "text-danger hover:bg-danger-soft" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Heart className={cn("size-4 transition-transform", state.liked && "fill-current", busy && "scale-110")} aria-hidden />
      <span className="tabular-nums">{formatNumber(state.count)}</span>
      <span className="sr-only">curtidas</span>
    </button>
  );
}

export function ReplyForm({ threadId, placeholder }: { threadId: string; placeholder: string }) {
  const [body, setBody] = useState("");
  const [key, setKey] = useState(0);
  const { run, pending, fieldErrors } = useAction(replyAction, { errorToast: true });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ threadId, body });
    if (res?.ok) {
      setBody("");
      setKey((k) => k + 1);
      requestAnimationFrame(() => document.getElementById(`r-${res.data.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field error={fieldErrors.body}>
        <MarkdownEditor key={key} value={body} onChange={setBody} rows={5} maxLength={20000} placeholder={placeholder} invalid={!!fieldErrors.body} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={body.trim().length < 2}>
          Publicar resposta
        </Button>
      </div>
    </form>
  );
}

export function SolutionButton({ threadId, replyId, isSolution }: { threadId: string; replyId: string; isSolution: boolean }) {
  const { run, pending } = useAction(setSolutionAction, { errorToast: true });
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() => run({ threadId, replyId: isSolution ? null : replyId })}
      className={cn(isSolution ? "text-success hover:text-success" : "text-muted")}
    >
      {isSolution ? <CheckCircle2 /> : <Circle />}
      {isSolution ? "Solução aceita" : "Marcar como solução"}
    </Button>
  );
}

type Muteable = { id: string; name: string; mutedUntil: string | null };

export function ThreadMenu({
  threadId,
  isPinned,
  isLocked,
  canModerate,
  isAuthor,
  author,
  canMute,
}: {
  threadId: string;
  isPinned: boolean;
  isLocked: boolean;
  canModerate: boolean;
  isAuthor: boolean;
  author: Muteable;
  canMute: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [muteOpen, setMuteOpen] = useState(false);
  const { run } = useAction(moderateThreadAction, { errorToast: true });
  if (!canModerate && !isAuthor) return null;

  async function remove() {
    const ok = await confirm({
      title: "Remover esta discussão?",
      description: isAuthor ? "Ela deixará de aparecer na comunidade, com todas as respostas." : "Ela deixará de aparecer para todos. O autor será avisado e a ação fica registrada na auditoria.",
      confirmLabel: "Remover",
    });
    if (!ok) return;
    const res = await run({ threadId, action: "remove" });
    if (res?.ok) router.push("/community");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {canModerate && (
            <>
              <DropdownMenuLabel>Moderação</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => run({ threadId, action: isPinned ? "unpin" : "pin" })}>
                {isPinned ? <PinOff /> : <Pin />} {isPinned ? "Desafixar" : "Fixar no topo"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run({ threadId, action: isLocked ? "unlock" : "lock" })}>
                {isLocked ? <LockOpen /> : <Lock />} {isLocked ? "Reabrir respostas" : "Trancar respostas"}
              </DropdownMenuItem>
              {canMute && !isAuthor && (
                <DropdownMenuItem onSelect={() => setMuteOpen(true)}>
                  <ShieldBan /> {author.mutedUntil ? "Gerenciar silêncio do autor" : "Silenciar autor"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem tone="danger" onSelect={remove}>
            <Trash2 /> Remover discussão
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canMute && <MuteDialog open={muteOpen} onOpenChange={setMuteOpen} user={author} />}
    </>
  );
}

export function ReplyMenu({
  replyId,
  canModerate,
  isAuthor,
  author,
  canMute,
}: {
  replyId: string;
  canModerate: boolean;
  isAuthor: boolean;
  author: Muteable;
  canMute: boolean;
}) {
  const confirm = useConfirm();
  const [muteOpen, setMuteOpen] = useState(false);
  const { run } = useAction(removeReplyAction, { errorToast: true });
  if (!canModerate && !isAuthor) return null;

  async function remove() {
    const ok = await confirm({
      title: "Remover esta resposta?",
      description: isAuthor ? "Ela deixará de aparecer na discussão." : "Ela deixará de aparecer para todos. O autor será avisado e a ação fica registrada na auditoria.",
      confirmLabel: "Remover",
    });
    if (ok) await run({ replyId });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Ações da resposta">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {canMute && !isAuthor && (
            <DropdownMenuItem onSelect={() => setMuteOpen(true)}>
              <ShieldBan /> {author.mutedUntil ? "Gerenciar silêncio do autor" : "Silenciar autor"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem tone="danger" onSelect={remove}>
            <Trash2 /> Remover resposta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canMute && <MuteDialog open={muteOpen} onOpenChange={setMuteOpen} user={author} />}
    </>
  );
}

const DURATIONS = [
  { value: 1, label: "24 horas" },
  { value: 3, label: "3 dias" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 365, label: "1 ano" },
] as const;

function MuteDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user: Muteable }) {
  const [days, setDays] = useState<(typeof DURATIONS)[number]["value"]>(7);
  const [reason, setReason] = useState("");
  const { run, pending } = useAction(muteUserAction, { errorToast: true });
  const muted = !!user.mutedUntil && new Date(user.mutedUntil) > new Date();

  async function apply(d: 0 | (typeof DURATIONS)[number]["value"]) {
    const res = await run({ userId: user.id, days: d, reason: reason.trim() || undefined });
    if (res?.ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Silenciar ${user.name} na comunidade`}
        description="Durante o período, a pessoa continua lendo as discussões, mas não pode publicar nem responder. Ela é avisada por notificação."
        size="sm"
        footer={
          <>
            {muted && (
              <Button variant="outline" className="sm:mr-auto" loading={pending} onClick={() => apply(0)}>
                Liberar agora
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="danger" loading={pending} onClick={() => apply(days)}>
              {muted ? "Atualizar período" : "Silenciar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {muted && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-small text-warning">
              Silenciado até {new Date(user.mutedUntil!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.
            </p>
          )}
          <Field label="Duração">
            <NativeSelect value={days} onChange={(e) => setDays(Number(e.target.value) as typeof days)}>
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Motivo" hint="Opcional. Será mostrado à pessoa.">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ex.: linguagem ofensiva" />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
