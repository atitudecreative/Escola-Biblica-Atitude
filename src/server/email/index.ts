import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { renderEmail, type EmailTemplate, type TemplateData } from "./templates";

/**
 * Envio de e-mails via padrão outbox: toda mensagem é gravada em email_outbox
 * e então entregue pelo provedor configurado (EMAIL_PROVIDER).
 *
 *  - log:    não envia; registra a mensagem (status LOGGED). Visível em Admin › Logs › E-mails.
 *  - resend: API HTTP da Resend (RESEND_API_KEY).
 *  - smtp:   qualquer servidor SMTP (SMTP_URL, ex.: smtps://user:pass@host:465).
 */
interface EmailProvider {
  name: string;
  send(msg: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

const resendProvider: EmailProvider = {
  name: "resend",
  async send(msg) {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, ...msg }),
    });
    if (!res.ok) throw new Error(`Resend respondeu ${res.status}: ${await res.text()}`);
  },
};

const smtpProvider: EmailProvider = {
  name: "smtp",
  async send(msg) {
    if (!env.SMTP_URL) throw new Error("SMTP_URL não configurada");
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(env.SMTP_URL);
    await transport.sendMail({ from: env.EMAIL_FROM, ...msg });
  },
};

function provider(): EmailProvider | null {
  if (env.EMAIL_PROVIDER === "resend") return resendProvider;
  if (env.EMAIL_PROVIDER === "smtp") return smtpProvider;
  return null;
}

export async function sendEmail<T extends EmailTemplate>(to: string, template: T, data: TemplateData[T]) {
  const { subject, text, html } = await renderEmail(template, data);
  const p = provider();
  const record = await db.emailMessage.create({
    data: { to, subject, text, html, template, provider: p?.name ?? "log", status: p ? "QUEUED" : "LOGGED" },
  });
  if (!p) {
    logger.info("email.logged", { to, template, id: record.id });
    return;
  }
  try {
    await p.send({ to, subject, text, html });
    await db.emailMessage.update({ where: { id: record.id }, data: { status: "SENT", sentAt: new Date() } });
  } catch (error) {
    logger.error("email.send_failed", { to, template, error, category: "infra" });
    await db.emailMessage.update({
      where: { id: record.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "erro" },
    });
  }
}
