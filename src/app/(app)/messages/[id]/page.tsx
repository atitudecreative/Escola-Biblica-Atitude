import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/guards";
import { getConversation } from "@/server/services/messages";
import { NotFoundError } from "@/server/errors";
import { ConversationView } from "@/components/messages/conversation-view";

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const user = await requirePermissionPage("messages.send", "support.respond");
  const { id } = await params;
  const conversation = await getConversation(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  // `key` reinicia o estado local ao trocar de conversa.
  return <ConversationView key={conversation.id} initial={conversation} />;
}
