"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/server/auth/guards";
import { parseInput, runAction } from "@/server/action";
import { revokeAllSessions } from "@/server/auth/session";
import { changePassword } from "@/server/services/auth";
import { revokeSession, savePrivacy, updateProfile } from "@/server/services/profile";
import { changePasswordSchema } from "@/lib/validation/auth";
import { privacySchema, profileSchema } from "@/lib/validation/profile";
import { ForbiddenError } from "@/server/errors";
import { audit } from "@/server/audit";

export async function updateProfileAction(input: unknown) {
  return runAction("update_profile", async () => {
    const user = await assertUser();
    await updateProfile(user.id, parseInput(profileSchema, input));
    refresh();
  }, "Perfil atualizado.");
}

export async function changePasswordAction(input: unknown) {
  return runAction("change_password", async () => {
    const user = await assertUser();
    const data = parseInput(changePasswordSchema, input);
    await changePassword(user.id, user.sessionId, data.current, data.password);
  }, "Senha alterada. Outras sessões foram encerradas.");
}

export async function savePrivacyAction(input: unknown) {
  return runAction("save_privacy", async () => {
    const user = await assertUser();
    await savePrivacy(user.id, parseInput(privacySchema, input));
  }, "Preferências de privacidade salvas.");
}

export async function revokeSessionAction(sessionId: string) {
  return runAction("revoke_session", async () => {
    const user = await assertUser();
    const id = parseInput(z.string().min(10).max(40), sessionId);
    if (id === user.sessionId) throw new ForbiddenError("Para encerrar esta sessão, use “Sair”.");
    await revokeSession(user.id, id);
    refresh();
  }, "Sessão encerrada.");
}

export async function revokeOtherSessionsAction() {
  return runAction("revoke_other_sessions", async () => {
    const user = await assertUser();
    await revokeAllSessions(user.id, user.sessionId);
    await audit("auth.sessions_revoked", { actorId: user.id, entityType: "user", entityId: user.id });
    refresh();
  }, "Todas as outras sessões foram encerradas.");
}
