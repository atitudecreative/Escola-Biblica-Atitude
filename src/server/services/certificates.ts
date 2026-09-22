import "server-only";
import { randomInt } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { notify } from "./notifications";
import { sendEmail } from "@/server/email";
import { emitWebhook } from "./webhooks";
import { audit } from "@/server/audit";
import { formatDate } from "@/lib/format";
import { logger } from "@/server/logger";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sem 0/O/1/I/L — fácil de digitar

function block(n = 4) {
  return Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

async function uniqueCode(prefix: string) {
  for (let i = 0; i < 5; i++) {
    const code = `${prefix}-${new Date().getFullYear()}-${block()}-${block()}`;
    if (!(await db.certificate.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Não foi possível gerar código único de certificado");
}

export function certificateUrl(code: string) {
  return `${env.APP_URL}/certificate/${code}`;
}

/** Emite (idempotente) o certificado de uma matrícula concluída. */
export async function issueCertificate(enrollmentId: string) {
  const existing = await db.certificate.findUnique({ where: { enrollmentId } });
  if (existing) return existing;

  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { user: true, course: { include: { instructor: true } } },
  });
  if (enrollment.status !== "COMPLETED" || !enrollment.course.certificateEnabled) return null;

  const courses = await getSettings("courses");
  const template =
    (enrollment.course.certificateTemplateId &&
      (await db.certificateTemplate.findUnique({ where: { id: enrollment.course.certificateTemplateId } }))) ||
    (await db.certificateTemplate.findFirst({ where: { isDefault: true } }));

  const cert = await db.certificate.create({
    data: {
      code: await uniqueCode(courses.certificatePrefix),
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      enrollmentId,
      templateId: template?.id,
      studentName: enrollment.user.name,
      courseTitle: enrollment.course.title,
      instructorName: enrollment.course.instructor.name,
      workloadHours: enrollment.course.workloadHours || Math.max(1, Math.round(enrollment.course.durationMinutes / 60)),
    },
  });

  await notify(enrollment.userId, {
    type: "CERTIFICATE",
    title: "Seu certificado está pronto",
    body: `Parabéns por concluir ${enrollment.course.title}!`,
    link: `/certificates`,
  });
  await sendEmail(enrollment.user.email, "certificate-issued", {
    name: enrollment.user.name.split(" ")[0],
    course: enrollment.course.title,
    url: `/certificate/${cert.code}`,
  }).catch((error) => logger.error("certificate.email_failed", { error, category: "infra" }));
  await audit("certificate.issued", { actorId: enrollment.userId, entityType: "certificate", entityId: cert.id });
  emitWebhook("certificate.issued", { code: cert.code, userId: cert.userId, courseId: cert.courseId });
  return cert;
}

export async function getCertificateByCode(code: string) {
  return db.certificate.findUnique({
    where: { code: code.toUpperCase() },
    include: { template: true, course: { select: { slug: true, title: true } } },
  });
}

// ── PDF ─────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderCertificatePdf(code: string) {
  const cert = await getCertificateByCode(code);
  if (!cert) return null;
  const general = await getSettings("general");
  const template = cert.template ?? (await db.certificateTemplate.findFirst({ where: { isDefault: true } }));
  const accent = hexToRgb(template?.accentColor ?? "#1F5B4B");
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.4, 0.39, 0.36);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado ${cert.code}`);
  pdf.setAuthor(general.platformName);
  const page = pdf.addPage([842, 595]); // A4 paisagem
  const { width, height } = page.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.98, 0.965) });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: accent, borderWidth: 1.2 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: accent, borderWidth: 0.4, opacity: 0 });
  page.drawRectangle({ x: 24, y: height - 32, width: width - 48, height: 8, color: accent });

  const center = (text: string, y: number, font: PDFFont, size: number, color = ink) =>
    page.drawText(text, { x: (width - font.widthOfTextAtSize(text, size)) / 2, y, font, size, color });

  center(general.platformName.toUpperCase(), height - 88, sansBold, 10, accent);
  center(template?.heading ?? "Certificado de Conclusão", height - 140, serif, 38);
  center("Certificamos que", height - 188, sans, 12, muted);
  center(cert.studentName, height - 236, serifItalic, 34);
  page.drawLine({ start: { x: width / 2 - 170, y: height - 250 }, end: { x: width / 2 + 170, y: height - 250 }, thickness: 0.6, color: accent });

  const body = (template?.body ?? "concluiu o curso {{curso}}, com carga horária de {{carga}} horas, em {{data}}.")
    .replaceAll("{{aluno}}", cert.studentName)
    .replaceAll("{{curso}}", cert.courseTitle)
    .replaceAll("{{carga}}", String(cert.workloadHours))
    .replaceAll("{{data}}", formatDate(cert.issuedAt))
    .replaceAll("{{professor}}", cert.instructorName);
  wrap(body, sans, 13, 560).forEach((line, i) => center(line, height - 288 - i * 20, sans, 13, ink));

  // Assinaturas
  const sigY = 118;
  const sig = (x: number, name: string, role: string) => {
    page.drawLine({ start: { x: x - 100, y: sigY + 18 }, end: { x: x + 100, y: sigY + 18 }, thickness: 0.6, color: muted });
    page.drawText(name, { x: x - sansBold.widthOfTextAtSize(name, 11) / 2, y: sigY, font: sansBold, size: 11, color: ink });
    page.drawText(role, { x: x - sans.widthOfTextAtSize(role, 9) / 2, y: sigY - 14, font: sans, size: 9, color: muted });
  };
  sig(230, cert.instructorName, "Professor(a) responsável");
  sig(width - 330, template?.signatureName ?? general.platformName, template?.signatureRole ?? "Direção");

  // QR de validação
  const url = certificateUrl(cert.code);
  const qr = await QRCode.toBuffer(url, { margin: 0, width: 240, color: { dark: "#1b1a17", light: "#fbfaf6" } });
  const img = await pdf.embedPng(qr);
  page.drawImage(img, { x: width - 150, y: 64, width: 84, height: 84 });
  page.drawText("Valide em", { x: width - 150, y: 52, font: sans, size: 7, color: muted });
  page.drawText(url.replace(/^https?:\/\//, ""), { x: width - 150, y: 42, font: sans, size: 6, color: muted });
  page.drawText(`Código: ${cert.code}`, { x: 60, y: 52, font: sansBold, size: 9, color: accent });
  page.drawText(`Emitido em ${formatDate(cert.issuedAt)}`, { x: 60, y: 40, font: sans, size: 8, color: muted });
  if (cert.revokedAt) {
    page.drawText("REVOGADO", { x: width / 2 - 120, y: height / 2 - 30, font: sansBold, size: 64, color: rgb(0.75, 0.2, 0.18), opacity: 0.25 });
  }
  return { bytes: await pdf.save(), cert };
}
