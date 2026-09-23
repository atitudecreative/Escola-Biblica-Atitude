import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/guards";
import { listConversations, supportAvailable } from "@/server/services/messages";
import { MessagesProvider } from "@/components/messages/messages-provider";
import { MessagesShell } from "@/components/messages/messages-shell";
import { ConversationList } from "@/components/messages/conversation-list";

export const metadata: Metadata = { title: "Mensagens" };

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermissionPage("messages.send", "support.respond");
  const [conversations, supportEnabled] = await Promise.all([listConversations(user), supportAvailable()]);
  // Quem atende o suporte não abre chamados para si mesmo.
  const canStartSupport = user.permissions.has("messages.send") && !user.permissions.has("support.respond");
  return (
    <MessagesProvider me={user.id} initial={conversations}>
      <MessagesShell list={<ConversationList supportEnabled={supportEnabled} canStartSupport={canStartSupport} />}>{children}</MessagesShell>
    </MessagesProvider>
  );
}
