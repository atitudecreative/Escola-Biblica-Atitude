import "server-only";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";

export type TemplateData = {
  "verify-email": { name: string; url: string };
  "password-reset": { name: string; url: string };
  welcome: { name: string; url: string };
  announcement: { name: string; title: string; body: string; url: string };
  "certificate-issued": { name: string; course: string; url: string };
  "assignment-graded": { name: string; assignment: string; status: string; url: string };
  "account-invite": { name: string; url: string };
};
export type EmailTemplate = keyof TemplateData;

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function absolute(url: string) {
  return url.startsWith("http") ? url : `${env.APP_URL}${url}`;
}

type Content = { subject: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string }; note?: string };

function build(data: { [K in EmailTemplate]: (d: TemplateData[K]) => Content }) {
  return data;
}

const templates = build({
  "verify-email": (d) => ({
    subject: "Confirme seu e-mail",
    heading: `Olá, ${d.name}`,
    paragraphs: ["Falta pouco! Confirme seu endereço de e-mail para ativar todos os recursos da sua conta."],
    cta: { label: "Confirmar e-mail", url: d.url },
    note: "O link expira em 24 horas. Se você não criou esta conta, ignore esta mensagem.",
  }),
  "password-reset": (d) => ({
    subject: "Redefinição de senha",
    heading: `Olá, ${d.name}`,
    paragraphs: ["Recebemos um pedido para redefinir a senha da sua conta."],
    cta: { label: "Criar nova senha", url: d.url },
    note: "O link expira em 1 hora e só pode ser usado uma vez. Se não foi você, sua senha continua a mesma.",
  }),
  welcome: (d) => ({
    subject: "Boas-vindas à Escola",
    heading: `Que bom ter você aqui, ${d.name}!`,
    paragraphs: ["Sua conta foi criada. Explore o catálogo e comece seu primeiro curso quando quiser."],
    cta: { label: "Explorar cursos", url: d.url },
  }),
  announcement: (d) => ({
    subject: d.title,
    heading: d.title,
    paragraphs: d.body.split(/\n{2,}/),
    cta: { label: "Ver na plataforma", url: d.url },
  }),
  "certificate-issued": (d) => ({
    subject: `Seu certificado de ${d.course} está pronto`,
    heading: `Parabéns, ${d.name}!`,
    paragraphs: [`Você concluiu o curso ${d.course}. Seu certificado já pode ser baixado e validado publicamente.`],
    cta: { label: "Ver certificado", url: d.url },
  }),
  "assignment-graded": (d) => ({
    subject: `Atividade corrigida: ${d.assignment}`,
    heading: `Olá, ${d.name}`,
    paragraphs: [`Sua atividade "${d.assignment}" foi corrigida. Status: ${d.status}.`],
    cta: { label: "Ver correção", url: d.url },
  }),
  "account-invite": (d) => ({
    subject: "Sua conta na Escola foi criada",
    heading: `Olá, ${d.name}`,
    paragraphs: ["A secretaria criou uma conta para você na plataforma. Para começar, defina sua senha de acesso."],
    cta: { label: "Definir minha senha", url: d.url },
    note: "O link expira em 72 horas e só pode ser usado uma vez. Se você não esperava este e-mail, ignore-o.",
  }),
});

export async function renderEmail<T extends EmailTemplate>(template: T, data: TemplateData[T]) {
  const [general, appearance, communication] = await Promise.all([
    getSettings("general"),
    getSettings("appearance"),
    getSettings("communication"),
  ]);
  const c = (templates[template] as (d: TemplateData[T]) => Content)(data);
  const cta = c.cta ? { ...c.cta, url: absolute(c.cta.url) } : undefined;

  const text = [
    c.heading,
    "",
    ...c.paragraphs,
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    ...(c.note ? ["", c.note] : []),
    "",
    "—",
    communication.emailSignature,
  ].join("\n");

  const color = appearance.primaryColor;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f4f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1b18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5df;border-radius:12px">
<tr><td style="padding:28px 32px 8px;font-weight:600;font-size:14px;color:${color}">${escape(general.platformName)}</td></tr>
<tr><td style="padding:8px 32px 0"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escape(c.heading)}</h1>
${c.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d3c37">${escape(p)}</p>`).join("")}
${cta ? `<p style="margin:24px 0"><a href="${escape(cta.url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px">${escape(cta.label)}</a></p>` : ""}
${c.note ? `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#6b6a63">${escape(c.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12px;color:#8a8880;border-top:1px solid #efede8">${escape(communication.emailSignature)}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: c.subject, text, html };
}
