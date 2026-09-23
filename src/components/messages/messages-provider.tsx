"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ConversationSummary } from "@/server/services/messages";
import { inboxAction } from "@/app/(app)/messages/actions";
import { useVisibleInterval } from "@/components/communication/use-visible-interval";

type Ctx = {
  me: string;
  conversations: ConversationSummary[];
  activeId: string | null;
  /** Atualiza a prévia/ordem da conversa após enviar ou receber mensagens. */
  bump: (id: string, patch: Partial<ConversationSummary>) => void;
  markLocalRead: (id: string) => void;
  reload: () => Promise<void>;
};

const MessagesCtx = createContext<Ctx | null>(null);

/** Intervalo da caixa de entrada (lista). A conversa aberta usa um polling próprio, mais curto. */
const INBOX_POLL_MS = 15_000;

export function MessagesProvider({ me, initial, children }: { me: string; initial: ConversationSummary[]; children: React.ReactNode }) {
  const [conversations, setConversations] = useState(initial);
  const segment = useSelectedLayoutSegment();
  const activeId = segment && segment !== "(.)" ? segment : null;

  const reload = useCallback(async () => {
    const res = await inboxAction();
    if (res.ok) setConversations(res.data);
  }, []);

  useVisibleInterval(reload, INBOX_POLL_MS);

  // Conversa recém-criada (ex.: ?to=) que ainda não está na lista.
  useEffect(() => {
    if (!activeId || conversations.some((c) => c.id === activeId)) return;
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [activeId, conversations, reload]);

  const bump = useCallback((id: string, patch: Partial<ConversationSummary>) => {
    setConversations((list) => {
      const current = list.find((c) => c.id === id);
      if (!current) return list;
      const next = { ...current, ...patch };
      return [next, ...list.filter((c) => c.id !== id)].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    });
  }, []);

  const markLocalRead = useCallback((id: string) => {
    setConversations((list) => list.map((c) => (c.id === id && c.unread ? { ...c, unread: 0 } : c)));
  }, []);

  const value = useMemo(() => ({ me, conversations, activeId, bump, markLocalRead, reload }), [me, conversations, activeId, bump, markLocalRead, reload]);
  return <MessagesCtx.Provider value={value}>{children}</MessagesCtx.Provider>;
}

export function useMessages() {
  const ctx = useContext(MessagesCtx);
  if (!ctx) throw new Error("useMessages precisa estar dentro de <MessagesProvider>");
  return ctx;
}
