"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LifeBuoy, MessageSquarePlus, Paperclip, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listStamp } from "@/components/communication/time";
import type { ConversationSummary } from "@/server/services/messages";
import { useMessages } from "./messages-provider";
import { NewConversationDialog } from "./new-conversation-dialog";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ConversationAvatar({ c, size = "md" }: { c: Pick<ConversationSummary, "type" | "avatar" | "title">; size?: "sm" | "md" }) {
  if (c.type === "SUPPORT" && c.avatar.name === "Suporte") {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary", size === "md" ? "size-10" : "size-8")}>
        <LifeBuoy className={size === "md" ? "size-5" : "size-4"} aria-hidden />
        <span className="sr-only">Suporte</span>
      </span>
    );
  }
  return <Avatar name={c.avatar.name} src={c.avatar.avatarUrl} size={size} />;
}

export function ConversationList({ supportEnabled, canStartSupport }: { supportEnabled: boolean; canStartSupport: boolean }) {
  const { conversations, activeId } = useMessages();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadTotal = conversations.filter((c) => c.unread > 0).length;

  const shown = useMemo(() => {
    const term = normalize(q.trim());
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (!term) return true;
      return normalize(`${c.title} ${c.subtitle ?? ""} ${c.last?.body ?? ""}`).includes(term);
    });
  }, [conversations, q, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-0 pb-3 md:px-4 md:pt-4">
        <div className="min-w-0">
          <h1 className="text-h2 text-fg md:text-h3">Mensagens</h1>
          <p className="text-small text-muted md:sr-only">
            {unreadTotal ? `${unreadTotal} ${unreadTotal === 1 ? "conversa não lida" : "conversas não lidas"}` : "Tudo lido"}
          </p>
        </div>
        <NewConversationDialog supportEnabled={supportEnabled} canStartSupport={canStartSupport}>
          <Button size="sm" aria-label="Nova conversa">
            <MessageSquarePlus /> <span>Nova</span>
          </Button>
        </NewConversationDialog>
      </div>

      <div className="space-y-2 pb-3 md:px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas" className="pr-9 pl-9" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Limpar busca" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div role="tablist" aria-label="Filtrar conversas" className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {(
            [
              ["all", "Todas"],
              ["unread", unreadTotal ? `Não lidas · ${unreadTotal}` : "Não lidas"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                "h-8 rounded-md px-3 text-small font-medium transition-all",
                filter === k ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 min-h-0 flex-1 overflow-y-auto border-t border-border md:mx-0">
        {shown.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-fg">
              {conversations.length === 0 ? "Nenhuma conversa ainda" : filter === "unread" && !q ? "Nenhuma conversa não lida" : "Nada encontrado"}
            </p>
            <p className="mt-1 text-small text-muted">
              {conversations.length === 0
                ? "Converse com seus professores ou fale com o suporte da Escola."
                : filter === "unread" && !q
                  ? "Você está em dia com suas mensagens."
                  : "Tente outro nome ou palavra."}
            </p>
            {conversations.length === 0 && (
              <NewConversationDialog supportEnabled={supportEnabled} canStartSupport={canStartSupport}>
                <Button variant="outline" size="sm" className="mt-4">
                  <MessageSquarePlus /> Iniciar conversa
                </Button>
              </NewConversationDialog>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((c) => (
              <ConversationRow key={c.id} c={c} active={c.id === activeId} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationRow({ c, active }: { c: ConversationSummary; active: boolean }) {
  const unread = c.unread > 0 && !active;
  return (
    <li>
      <Link
        href={`/messages/${c.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2",
          active && "bg-surface-2 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary",
        )}
      >
        <ConversationAvatar c={c} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn("truncate text-sm", unread ? "font-semibold text-fg" : "font-medium text-fg")}>{c.title}</span>
            <span suppressHydrationWarning className={cn("ml-auto shrink-0 text-caption tabular-nums", unread ? "font-medium text-primary" : "text-subtle")}>
              {listStamp(c.lastMessageAt)}
            </span>
          </div>
          {c.subtitle && <p className="truncate text-caption text-subtle">{c.subtitle}</p>}
          <div className="mt-0.5 flex items-center gap-2">
            <p className={cn("line-clamp-1 min-w-0 flex-1 text-small", unread ? "text-fg" : "text-muted")}>
              {c.last ? (
                <>
                  {c.last.mine && <span className="text-subtle">Você: </span>}
                  {c.last.hasAttachment && <Paperclip className="mr-1 inline size-3.5 align-[-2px] text-subtle" aria-label="Anexo" />}
                  {c.last.body || (c.last.hasAttachment ? "Anexo" : "")}
                </>
              ) : (
                <span className="text-subtle italic">Sem mensagens ainda</span>
              )}
            </p>
            {unread && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-fg tabular-nums">
                {c.unread > 99 ? "99+" : c.unread}
                <span className="sr-only"> não lidas</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
