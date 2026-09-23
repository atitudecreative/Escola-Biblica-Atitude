"use server";
import { refresh } from "next/cache";
import { assertUser } from "@/server/auth/guards";
import { runAction } from "@/server/action";
import {
  createThread,
  moderateThread,
  removeReply,
  replyToThread,
  setCommunityMute,
  setSolution,
  toggleLike,
} from "@/server/services/community";

export async function createThreadAction(input: { type: "QUESTION" | "DISCUSSION"; title: string; body: string; courseId: string | null }) {
  return runAction("community.create", async () => createThread(await assertUser(), input), "Publicado na comunidade.");
}

export async function replyAction(input: { threadId: string; body: string }) {
  return runAction(
    "community.reply",
    async () => {
      const r = await replyToThread(await assertUser(), input);
      refresh();
      return r;
    },
    "Resposta publicada.",
  );
}

export async function toggleLikeAction(input: { threadId: string } | { replyId: string }) {
  return runAction("community.like", async () => toggleLike(await assertUser(), input));
}

export async function setSolutionAction(input: { threadId: string; replyId: string | null }) {
  return runAction(
    "community.solution",
    async () => {
      const r = await setSolution(await assertUser(), input);
      refresh();
      return r;
    },
    input.replyId ? "Resposta marcada como solução." : "Solução desmarcada.",
  );
}

const MOD_MSG = { pin: "Discussão fixada.", unpin: "Discussão desafixada.", lock: "Discussão trancada.", unlock: "Discussão reaberta.", remove: "Discussão removida." };

export async function moderateThreadAction(input: { threadId: string; action: keyof typeof MOD_MSG; reason?: string }) {
  return runAction(
    "community.moderate",
    async () => {
      await moderateThread(await assertUser(), input);
      if (input.action !== "remove") refresh();
    },
    MOD_MSG[input.action] ?? "Feito.",
  );
}

export async function removeReplyAction(input: { replyId: string; reason?: string }) {
  return runAction(
    "community.remove_reply",
    async () => {
      const r = await removeReply(await assertUser(), input);
      refresh();
      return r;
    },
    "Resposta removida.",
  );
}

export async function muteUserAction(input: { userId: string; days: 0 | 1 | 3 | 7 | 30 | 365; reason?: string }) {
  return runAction(
    "community.mute",
    async () => {
      const r = await setCommunityMute(await assertUser(), input);
      refresh();
      return r;
    },
    input.days ? "Usuário silenciado na comunidade." : "Usuário liberado na comunidade.",
  );
}
