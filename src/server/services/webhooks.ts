import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

export type WebhookEvent =
  | "enrollment.created"
  | "lesson.completed"
  | "course.completed"
  | "certificate.issued"
  | "user.registered"
  | "course.published";

/**
 * Dispara o evento para os endpoints inscritos (Admin › Configurações › Integrações).
 * Assinatura: header X-EBA-Signature = HMAC-SHA256(secret, corpo).
 * Executa após a resposta (after), sem atrasar o usuário.
 */
export function emitWebhook(event: WebhookEvent, data: Record<string, unknown>) {
  const run = async () => {
    const endpoints = await db.webhookEndpoint.findMany({ where: { isActive: true, events: { has: event } } });
    for (const ep of endpoints) {
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
        });
        statusCode = res.status;
      } catch (e) {
        error = e instanceof Error ? e.message : "erro";
        logger.warn("webhook.delivery_failed", { url: ep.url, event, error, category: "infra" });
      }
      await db.webhookDelivery.create({ data: { endpointId: ep.id, event, payload: JSON.parse(body), statusCode, error } });
    }
  };
  try {
    after(run);
  } catch {
    void run().catch(() => undefined);
  }
}
