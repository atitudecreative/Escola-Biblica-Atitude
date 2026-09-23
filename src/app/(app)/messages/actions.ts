"use server";
import { z } from "zod";
import { refresh } from "next/cache";
import { assertUser } from "@/server/auth/guards";
import { parseInput, runAction } from "@/server/action";
import {
  listContacts,
  listConversations,
  loadOlderMessages,
  markConversationRead,
  openDirectConversation,
  openSupportConversation,
  pollConversation,
  sendMessage,
} from "@/server/services/messages";

const id = z.string().min(1).max(40);

export async function sendMessageAction(input: { conversationId: string; body: string; attachmentId?: string | null }) {
  return runAction("messages.send", async () => sendMessage(await assertUser(), input));
}

export async function pollConversationAction(input: { conversationId: string; afterId: string | null; markRead: boolean }) {
  return runAction("messages.poll", async () => {
    const data = parseInput(z.object({ conversationId: id, afterId: id.nullable(), markRead: z.boolean() }), input);
    return pollConversation(await assertUser(), data.conversationId, data.afterId, data.markRead);
  });
}

export async function loadOlderMessagesAction(input: { conversationId: string; beforeId: string }) {
  return runAction("messages.older", async () => {
    const data = parseInput(z.object({ conversationId: id, beforeId: id }), input);
    return loadOlderMessages(await assertUser(), data.conversationId, data.beforeId);
  });
}

/** Marca como lida e atualiza os contadores do shell (sidebar/sino). */
export async function markConversationReadAction(conversationId: string) {
  return runAction("messages.read", async () => {
    await markConversationRead(await assertUser(), id.parse(conversationId));
    refresh();
  });
}

export async function inboxAction() {
  return runAction("messages.inbox", async () => listConversations(await assertUser()));
}

export async function contactsAction(q: string) {
  return runAction("messages.contacts", async () => listContacts(await assertUser(), z.string().max(80).parse(q)));
}

export async function openDirectAction(targetId: string) {
  return runAction("messages.open_direct", async () => openDirectConversation(await assertUser(), targetId));
}

export async function openSupportAction(input: { subject: string; body: string }) {
  return runAction("messages.open_support", async () => openSupportConversation(await assertUser(), input), "Solicitação enviada. Nossa equipe responderá por aqui.");
}
