"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, ArrowDown, ArrowLeft, Check, CheckCheck, Download, FileText, Image as ImageIcon, Paperclip, RotateCw, SendHorizontal, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import type { UploadedFile } from "@/hooks/use-upload";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttachmentDTO, ConversationDetail, MessageDTO } from "@/server/services/messages";
import { loadOlderMessagesAction, markConversationReadAction, pollConversationAction, sendMessageAction } from "@/app/(app)/messages/actions";
import { LinkifiedText } from "@/components/communication/linkified-text";
import { clock, dayKey, dayLabel, fullDateTime } from "@/components/communication/time";
import { useVisibleInterval } from "@/components/communication/use-visible-interval";
import { ConversationAvatar } from "./conversation-list";
import { useMessages } from "./messages-provider";

/**
 * Tempo quase real por polling leve: a cada 5 s, apenas com a aba visível,
 * uma Server Action busca só as mensagens posteriores à última conhecida
 * (cursor). Escolhemos isso em vez de router.refresh() porque o refresh
 * re-renderiza toda a árvore RSC (layout, shell, lista) a cada ciclo; o cursor
 * devolve poucos bytes e nada quando não há novidade. Para SSE/WebSocket,
 * troque `useVisibleInterval(poll)` por uma assinatura que chame `merge()`.
 */
const POLL_MS = 5_000;
const GROUP_GAP_MS = 5 * 60_000;

type UIMessage = MessageDTO & { status?: "sending" | "error"; retry?: { body: string; attachmentId: string | null } };

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.jpg,.jpeg,.png,.webp";

export function ConversationView({ initial }: { initial: ConversationDetail }) {
  const { me, bump, markLocalRead } = useMessages();
  const [messages, setMessages] = useState<UIMessage[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [othersReadAt, setOthersReadAt] = useState(initial.othersLastReadAt);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const tempSeq = useRef(0);
  const conversationId = initial.id;

  // Ao abrir: marca como lida (se havia não lidas) e atualiza contadores do shell.
  useEffect(() => {
    markLocalRead(conversationId);
    if (initial.unread > 0) void markConversationReadAction(conversationId);
  }, [conversationId, initial.unread, markLocalRead]);

  // Rolagem inicial para o fim.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversationId]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(0);
  }, []);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const merge = useCallback(
    (incoming: MessageDTO[]) => {
      const known = new Set(messagesRef.current.map((m) => m.id));
      const added = incoming.filter((m) => !known.has(m.id));
      if (!added.length) return;
      setMessages((list) => {
        const ids = new Set(list.map((m) => m.id));
        return [...list, ...added.filter((m) => !ids.has(m.id))];
      });
      const last = added[added.length - 1];
      bump(conversationId, {
        lastMessageAt: last.createdAt,
        last: { body: last.body.slice(0, 160), senderId: last.senderId, mine: last.senderId === me, hasAttachment: !!last.attachment },
        unread: 0,
      });
      const fromOthers = added.filter((m) => m.senderId !== me).length;
      if (nearBottom.current) requestAnimationFrame(() => scrollToBottom(true));
      else if (fromOthers) setNewBelow((n) => n + fromOthers);
    },
    [bump, conversationId, me, scrollToBottom],
  );

  const lastServerId = useMemo(() => [...messages].reverse().find((m) => !m.status)?.id ?? null, [messages]);
  const lastIdRef = useRef(lastServerId);
  useEffect(() => {
    lastIdRef.current = lastServerId;
  }, [lastServerId]);

  const poll = useCallback(async () => {
    const res = await pollConversationAction({ conversationId, afterId: lastIdRef.current, markRead: true });
    if (!res.ok) return;
    merge(res.data.messages);
    setOthersReadAt(res.data.othersLastReadAt);
  }, [conversationId, merge]);

  useVisibleInterval(poll, POLL_MS);

  async function loadOlder() {
    const first = messages.find((m) => !m.status);
    if (!first) return;
    setLoadingOlder(true);
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await loadOlderMessagesAction({ conversationId, beforeId: first.id });
    setLoadingOlder(false);
    if (!res.ok) return toast.error(res.error);
    setHasMore(res.data.hasMore);
    setMessages((list) => {
      const known = new Set(list.map((m) => m.id));
      return [...res.data.messages.filter((m) => !known.has(m.id)), ...list];
    });
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  async function deliver(tempId: string, body: string, attachmentId: string | null) {
    const res = await sendMessageAction({ conversationId, body, attachmentId });
    setMessages((list) => {
      if (!res.ok) return list.map((m) => (m.id === tempId ? { ...m, status: "error" as const } : m));
      const without = list.filter((m) => m.id !== tempId);
      return without.some((m) => m.id === res.data.id) ? without : [...without, res.data];
    });
    if (res.ok) {
      bump(conversationId, {
        lastMessageAt: res.data.createdAt,
        last: { body: res.data.body.slice(0, 160), senderId: me, mine: true, hasAttachment: !!res.data.attachment },
      });
    } else toast.error(res.error);
    return res.ok;
  }

  function send(body: string, attachment: UploadedFile | null) {
    const tempId = `temp-${++tempSeq.current}`;
    const optimistic: UIMessage = {
      id: tempId,
      senderId: me,
      body,
      createdAt: new Date().toISOString(),
      attachment: attachment ? { id: attachment.id, name: attachment.name, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, url: attachment.url } : null,
      status: "sending",
      retry: { body, attachmentId: attachment?.id ?? null },
    };
    setMessages((list) => [...list, optimistic]);
    requestAnimationFrame(() => scrollToBottom(true));
    return deliver(tempId, body, attachment?.id ?? null);
  }

  function retry(m: UIMessage) {
    if (!m.retry) return;
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, status: "sending" as const } : x)));
    void deliver(m.id, m.retry.body, m.retry.attachmentId);
  }

  function discard(m: UIMessage) {
    setMessages((list) => list.filter((x) => x.id !== m.id));
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom.current && newBelow) setNewBelow(0);
  }

  const people = useMemo(() => new Map(initial.others.map((o) => [o.id, o])), [initial.others]);
  const multi = initial.others.length > 1;
  const lastMine = [...messages].reverse().find((m) => m.senderId === me && !m.status);
  const isLastOverall = lastMine && messages[messages.length - 1]?.id === lastMine.id;
  const seen = !!(lastMine && othersReadAt && othersReadAt >= lastMine.createdAt);
  const headerSub =
    initial.type === "SUPPORT" ? initial.subtitle : [initial.others[0]?.roleLabel, initial.subtitle].filter(Boolean).join(" · ") || null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabeçalho */}
      <header className="flex h-15 shrink-0 items-center gap-3 border-b border-border bg-surface px-2 md:px-5">
        <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Voltar para conversas">
          <Link href="/messages">
            <ArrowLeft />
          </Link>
        </Button>
        <ConversationAvatar c={initial} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-fg">{initial.title}</h2>
          {headerSub && <p className="truncate text-caption text-muted">{headerSub}</p>}
        </div>
      </header>

      {/* Mensagens */}
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain px-3 py-4 md:px-6" aria-live="polite" aria-relevant="additions">
          {hasMore && (
            <div className="mb-4 flex justify-center">
              <Button variant="ghost" size="sm" onClick={loadOlder} loading={loadingOlder}>
                Carregar mensagens anteriores
              </Button>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <ConversationAvatar c={initial} />
              <p className="mt-3 text-sm font-medium text-fg">Comece a conversa com {initial.type === "SUPPORT" ? "o suporte" : initial.title}</p>
              <p className="mt-1 max-w-xs text-small text-muted">Mensagens são privadas entre os participantes desta conversa.</p>
            </div>
          ) : (
            <MessageStream
              messages={messages}
              me={me}
              people={people}
              showNames={multi || initial.type === "SUPPORT"}
              onRetry={retry}
              onDiscard={discard}
              receipt={lastMine && isLastOverall ? { id: lastMine.id, seen } : null}
            />
          )}
        </div>
        {newBelow > 0 && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-small font-medium text-fg shadow-md"
          >
            <ArrowDown className="size-3.5" /> {newBelow === 1 ? "1 nova mensagem" : `${newBelow} novas mensagens`}
          </button>
        )}
      </div>

      {initial.canSend ? (
        <Composer onSend={send} />
      ) : (
        <p className="border-t border-border px-4 py-3 text-center text-small text-muted">Seu perfil não pode enviar mensagens.</p>
      )}
    </div>
  );
}

function MessageStream({
  messages,
  me,
  people,
  showNames,
  onRetry,
  onDiscard,
  receipt,
}: {
  messages: UIMessage[];
  me: string;
  people: Map<string, { name: string; avatarUrl: string | null; roleLabel: string }>;
  showNames: boolean;
  onRetry: (m: UIMessage) => void;
  onDiscard: (m: UIMessage) => void;
  receipt: { id: string; seen: boolean } | null;
}) {
  return (
    <ol className="flex flex-col">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
        const startsGroup = newDay || prev.senderId !== m.senderId || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS;
        const endsGroup =
          !next || next.senderId !== m.senderId || dayKey(next.createdAt) !== dayKey(m.createdAt) || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() > GROUP_GAP_MS;
        const mine = m.senderId === me;
        const person = people.get(m.senderId);
        return (
          <Fragment key={m.id}>
            {newDay && (
              <li className="sticky top-0 z-10 my-3 flex justify-center first:mt-0" aria-label={dayLabel(m.createdAt)}>
                <span suppressHydrationWarning className="rounded-full border border-border bg-surface/95 px-3 py-1 text-caption font-medium text-muted backdrop-blur">
                  {dayLabel(m.createdAt)}
                </span>
              </li>
            )}
            <li className={cn("flex gap-2", mine ? "justify-end" : "justify-start", startsGroup ? "mt-3" : "mt-0.5")}>
              {!mine && (
                <div className="w-8 shrink-0">
                  {endsGroup && person && <Avatar name={person.name} src={person.avatarUrl} size="sm" />}
                </div>
              )}
              <div className={cn("flex max-w-[82%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                {startsGroup && !mine && showNames && person && (
                  <span className="mb-1 px-1 text-caption font-medium text-muted">
                    {person.name} <span className="font-normal text-subtle">· {person.roleLabel}</span>
                  </span>
                )}
                <Bubble m={m} mine={mine} startsGroup={startsGroup} endsGroup={endsGroup} />
                {m.status === "sending" && (
                  <span className="mt-1 inline-flex items-center gap-1 px-1 text-caption text-subtle">
                    <Spinner className="size-3" /> Enviando…
                  </span>
                )}
                {m.status === "error" && (
                  <span className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-caption text-danger">
                    <AlertCircle className="size-3.5" aria-hidden /> Não enviada
                    <button onClick={() => onRetry(m)} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
                      <RotateCw className="size-3" /> Tentar novamente
                    </button>
                    <button onClick={() => onDiscard(m)} className="inline-flex items-center gap-1 text-muted hover:text-fg">
                      <Trash2 className="size-3" /> Descartar
                    </button>
                  </span>
                )}
                {!m.status && endsGroup && (
                  <span suppressHydrationWarning className="mt-1 inline-flex items-center gap-1 px-1 text-caption text-subtle tabular-nums">
                    {clock(m.createdAt)}
                    {receipt?.id === m.id &&
                      (receipt.seen ? (
                        <>
                          <span aria-hidden>·</span>
                          <CheckCheck className="size-3.5 text-primary" aria-hidden /> Vista
                        </>
                      ) : (
                        <>
                          <span aria-hidden>·</span>
                          <Check className="size-3.5" aria-hidden /> Enviada
                        </>
                      ))}
                  </span>
                )}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function Bubble({ m, mine, startsGroup, endsGroup }: { m: UIMessage; mine: boolean; startsGroup: boolean; endsGroup: boolean }) {
  const radius = mine
    ? cn("rounded-2xl", !startsGroup && "rounded-tr-md", !endsGroup && "rounded-br-md")
    : cn("rounded-2xl", !startsGroup && "rounded-tl-md", !endsGroup && "rounded-bl-md");
  return (
    <div
      title={fullDateTime(m.createdAt)}
      className={cn(
        "text-sm leading-relaxed",
        radius,
        mine ? "bg-primary text-primary-fg" : "border border-border bg-surface text-fg",
        m.status === "sending" && "opacity-70",
        m.status === "error" && "ring-2 ring-danger/50",
        m.body ? "px-3.5 py-2" : "p-1.5",
      )}
    >
      {m.attachment && <AttachmentCard a={m.attachment} mine={mine} spaced={!!m.body} />}
      {m.body && <LinkifiedText text={m.body} />}
    </div>
  );
}

function AttachmentCard({ a, mine, spaced }: { a: AttachmentDTO; mine: boolean; spaced: boolean }) {
  const image = /^image\/(png|jpeg|webp)$/.test(a.mimeType);
  return (
    <div className={cn(spaced && "-mx-1.5 mb-2 -mt-0.5")}>
      {image && (
        <a href={a.url} target="_blank" rel="noopener" className="mb-1.5 block overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com autorização */}
          <img src={a.url} alt={a.name} className="max-h-60 w-full max-w-72 object-cover" loading="lazy" />
        </a>
      )}
      <a
        href={`${a.url}?download=1`}
        className={cn(
          "flex min-w-52 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
          mine ? "bg-primary-fg/12 hover:bg-primary-fg/20" : "bg-surface-2 hover:bg-surface-3",
        )}
      >
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", mine ? "bg-primary-fg/15" : "bg-surface")}>
          {image ? <ImageIcon className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-medium">{a.name}</span>
          <span className={cn("block text-caption", mine ? "opacity-75" : "text-muted")}>{formatBytes(a.sizeBytes)}</span>
        </span>
        <Download className="size-4 shrink-0 opacity-70" aria-label="Baixar" />
      </a>
    </div>
  );
}

function Composer({ onSend }: { onSend: (body: string, attachment: UploadedFile | null) => Promise<boolean> }) {
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<UploadedFile | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const coarse = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [body]);

  const canSend = body.trim().length > 0 || !!attachment;

  function submit() {
    if (!canSend) return;
    const text = body.trim();
    const file = attachment;
    setBody("");
    setAttachment(null);
    void onSend(text, file);
    ref.current?.focus();
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-3 pt-2.5 pb-3 md:px-5">
      {attachment && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
          <FileText className="size-4 shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-small font-medium text-fg">{attachment.name}</span>
            <span className="block text-caption text-muted">{formatBytes(attachment.sizeBytes)} · pronto para enviar</span>
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setAttachment(null)} aria-label="Remover anexo">
            <X />
          </Button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        <Popover open={attachOpen} onOpenChange={setAttachOpen}>
          <Tooltip content="Anexar arquivo">
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Anexar arquivo">
                <Paperclip />
              </Button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent align="start" side="top" className="w-[min(92vw,340px)] p-3">
            <p className="mb-2 text-small font-medium text-fg">Anexar arquivo</p>
            <FileDropzone
              purpose="attachment"
              accept={ACCEPT}
              compact
              hint="PDF, Office, imagens, ZIP ou TXT · até 10 MB"
              onUploaded={(f) => {
                setAttachment(f);
                setAttachOpen(false);
                ref.current?.focus();
              }}
            />
          </PopoverContent>
        </Popover>
        <label htmlFor="composer" className="sr-only">
          Escreva uma mensagem
        </label>
        <textarea
          id="composer"
          ref={ref}
          value={body}
          rows={1}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !coarse) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Escreva uma mensagem"
          className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-border-strong bg-surface px-3.5 py-2 text-[0.9375rem] leading-6 text-fg outline-none placeholder:text-subtle focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/40 md:text-sm"
        />
        <Button type="submit" size="icon" className="size-10 shrink-0 rounded-xl" disabled={!canSend} aria-label="Enviar mensagem">
          <SendHorizontal />
        </Button>
      </form>
      {!coarse && <p className="mt-1.5 hidden pl-12 text-caption text-subtle md:block">Enter para enviar · Shift + Enter para quebrar a linha</p>}
    </div>
  );
}
