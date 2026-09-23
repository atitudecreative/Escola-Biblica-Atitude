import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

/** Catálogo de eventos disponíveis para inscrição (Admin › Configurações › Integrações). */
export const WEBHOOK_EVENTS = [
  { key: "enrollment.created", label: "Matrícula criada" },
  { key: "lesson.completed", label: "Aula concluída" },
  { key: "course.completed", label: "Curso concluído" },
  { key: "certificate.issued", label: "Certificado emitido" },
  { key: "user.registered", label: "Usuário cadastrado" },
  { key: "course.published", label: "Curso publicado" },
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]["key"];

/**
 * Entrega um evento a UM endpoint e registra a tentativa em webhook_deliveries.
 * Usado pelo disparo normal e pelo botão "Enviar teste".
 */
export async function deliverWebhook(
  ep: { id: string; url: string; secret: string },
  event: string,
  data: Record<string, unknown>,
) {
  const body = JSON.stringify({ event, data, sentAt: new Date().toISOString() });
  const signature = createHmac("sha256", ep.secret).update(body).digest("hex");
  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-EBA-Event": event, "X-EBA-Signature": signature },
      body,
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    });
    statusCode = res.status;
  } catch (e) {
    error = e instanceof Error ? e.message : "erro";
    logger.warn("webhook.delivery_failed", { url: ep.url, event, error, category: "infra" });
  }
  return db.webhookDelivery.create({ data: { endpointId: ep.id, event, payload: JSON.parse(body), statusCode, error } });
}

/**
 * Dispara o evento para os endpoints inscritos (Admin › Configurações › Integrações).
 * Assinatura: header X-EBA-Signature = HMAC-SHA256(secret, corpo).
 * Executa após a resposta (after), sem atrasar o usuário.
 */
export function emitWebhook(event: WebhookEvent, data: Record<string, unknown>) {
  const run = async () => {
    const endpoints = await db.webhookEndpoint.findMany({ where: { isActive: true, events: { has: event } } });
    for (const ep of endpoints) await deliverWebhook(ep, event, data);
  };
  try {
    after(run);
  } catch {
    void run().catch(() => undefined);
  }
}
