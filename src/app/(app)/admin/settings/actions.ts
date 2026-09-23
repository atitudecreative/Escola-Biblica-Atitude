"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import * as svc from "@/server/services/admin-settings";

const GROUPS = ["general", "appearance", "users", "courses", "communication", "security", "integrations"] as const;
const id = z.string().min(1).max(40);

export async function saveSettingsAction(input: unknown) {
  return runAction("admin.settings.save", async () => {
    const d = parseInput(z.object({ group: z.enum(GROUPS), values: z.unknown() }), input);
    await svc.saveSettingsGroup(d.group, d.values);
    revalidatePath("/", "layout");
  }, "Configurações salvas.");
}

export async function revokeSessionAction(sessionId: string) {
  return runAction("admin.session.revoke", async () => {
    await svc.revokeSession(parseInput(id, sessionId));
    revalidatePath("/admin/settings/security");
  }, "Sessão encerrada.");
}

export async function saveWebhookAction(input: unknown) {
  return runAction("admin.webhook.save", async () => {
    const r = await svc.saveWebhook(input);
    revalidatePath("/admin/settings/integrations");
    return r;
  });
}

export async function deleteWebhookAction(webhookId: string) {
  return runAction("admin.webhook.delete", async () => {
    await svc.deleteWebhook(parseInput(id, webhookId));
    revalidatePath("/admin/settings/integrations");
  }, "Endpoint excluído.");
}

export async function rotateWebhookSecretAction(webhookId: string) {
  return runAction("admin.webhook.rotate", async () => {
    const secret = await svc.rotateWebhookSecret(parseInput(id, webhookId));
    revalidatePath("/admin/settings/integrations");
    return secret;
  });
}

export async function testWebhookAction(webhookId: string) {
  return runAction("admin.webhook.test", async () => {
    const r = await svc.sendTestWebhook(parseInput(id, webhookId));
    revalidatePath("/admin/settings/integrations");
    return r;
  });
}
