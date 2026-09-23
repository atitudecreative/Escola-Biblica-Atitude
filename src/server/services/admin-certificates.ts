import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertPermission } from "@/server/auth/guards";
import { NotFoundError, ValidationError } from "@/server/errors";
import { parseInput } from "@/server/action";
import { notify } from "./notifications";
import { issueCertificate } from "./certificates";

/** Modelos e certificados emitidos. Permissão: certificates.manage. */

export const CERTIFICATE_PLACEHOLDERS = ["aluno", "curso", "carga", "data", "professor"] as const;

export const templateInput = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Informe o nome do modelo").max(80, "Máximo de 80 caracteres"),
    heading: z.string().trim().min(3, "Informe o título").max(60, "Máximo de 60 caracteres"),
    body: z.string().trim().min(10, "Escreva o texto do certificado").max(600, "Máximo de 600 caracteres"),
    signatureName: z.string().trim().min(2, "Informe quem assina").max(60, "Máximo de 60 caracteres"),
    signatureRole: z.string().trim().min(2, "Informe o cargo").max(80, "Máximo de 80 caracteres"),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB"),
    isDefault: z.boolean().default(false),
  })
  .superRefine((t, ctx) => {
    const unknown = [...t.body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)]
      .map((m) => m[1])
      .filter((k) => !(CERTIFICATE_PLACEHOLDERS as readonly string[]).includes(k));
    if (unknown.length)
      ctx.addIssue({ code: "custom", path: ["body"], message: `Marcador desconhecido: {{${unknown[0]}}}` });
    // Fontes padrão do PDF (WinAnsi) não desenham emojis e alguns símbolos.
    if (/[^\n\r\t -ÿ–—‘’“”•…]/.test(t.body + t.heading + t.signatureName + t.signatureRole))
      ctx.addIssue({ code: "custom", path: ["body"], message: "Remova emojis ou símbolos especiais — o PDF não consegue desenhá-los." });
  });

export async function listTemplates() {
  await assertPermission("certificates.manage");
  return db.certificateTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { courses: true, certificates: true } } },
  });
}

export async function saveTemplate(input: unknown) {
  const actor = await assertPermission("certificates.manage");
  const t = parseInput(templateInput, input);
  const { id, ...data } = t;
  const count = await db.certificateTemplate.count();
  const makeDefault = data.isDefault || count === 0;
  const savedId = await db.$transaction(async (tx) => {
    if (makeDefault) await tx.certificateTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    if (id) {
      const existing = await tx.certificateTemplate.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Modelo não encontrado.");
      // Não permite ficar sem modelo padrão.
      const isDefault = makeDefault || (existing.isDefault && !data.isDefault ? true : data.isDefault);
      await tx.certificateTemplate.update({ where: { id }, data: { ...data, isDefault } });
      return id;
    }
    return (await tx.certificateTemplate.create({ data: { ...data, isDefault: makeDefault } })).id;
  });
  await audit(id ? "certificate_template.updated" : "certificate_template.created", {
    actorId: actor.id,
    entityType: "certificate_template",
    entityId: savedId,
    metadata: { name: t.name },
  });
  return savedId;
}

export async function setDefaultTemplate(id: string) {
  const actor = await assertPermission("certificates.manage");
  const t = await db.certificateTemplate.findUnique({ where: { id } });
  if (!t) throw new NotFoundError("Modelo não encontrado.");
  await db.$transaction([
    db.certificateTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    db.certificateTemplate.update({ where: { id }, data: { isDefault: true } }),
  ]);
  await audit("certificate_template.default_set", { actorId: actor.id, entityType: "certificate_template", entityId: id });
}

export async function deleteTemplate(id: string) {
  const actor = await assertPermission("certificates.manage");
  const t = await db.certificateTemplate.findUnique({ where: { id }, include: { _count: { select: { courses: true, certificates: true } } } });
  if (!t) throw new NotFoundError("Modelo não encontrado.");
  if (t.isDefault) throw new ValidationError("Defina outro modelo como padrão antes de excluir este.");
  // Cursos e certificados passam a usar o modelo padrão (onDelete: SetNull).
  await db.certificateTemplate.delete({ where: { id } });
  await audit("certificate_template.deleted", { actorId: actor.id, entityType: "certificate_template", entityId: id, metadata: { name: t.name } });
}

// ── Certificados emitidos ───────────────────────────

export type IssuedFilters = { q?: string; status?: string; course?: string; page: number; pageSize: number };

export async function listIssuedCertificates(f: IssuedFilters) {
  await assertPermission("certificates.manage");
  const where: Prisma.CertificateWhereInput = {};
  if (f.q)
    where.OR = [
      { code: { contains: f.q.toUpperCase() } },
      { studentName: { contains: f.q, mode: "insensitive" } },
      { courseTitle: { contains: f.q, mode: "insensitive" } },
      { user: { email: { contains: f.q, mode: "insensitive" } } },
    ];
  if (f.status === "valid") where.revokedAt = null;
  if (f.status === "revoked") where.revokedAt = { not: null };
  if (f.course) where.courseId = f.course;
  const [total, rows, courses] = await Promise.all([
    db.certificate.count({ where }),
    db.certificate.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        code: true,
        studentName: true,
        courseTitle: true,
        workloadHours: true,
        issuedAt: true,
        revokedAt: true,
        revokedReason: true,
        user: { select: { id: true, email: true, avatarUrl: true } },
        template: { select: { name: true } },
      },
    }),
    db.course.findMany({ where: { certificates: { some: {} } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return { total, rows, courses };
}

export async function certificateStats() {
  await assertPermission("certificates.manage");
  const monthAgo = new Date(Date.now() - 30 * 86400_000);
  const [total, revoked, last30, eligible] = await Promise.all([
    db.certificate.count(),
    db.certificate.count({ where: { revokedAt: { not: null } } }),
    db.certificate.count({ where: { issuedAt: { gte: monthAgo } } }),
    db.enrollment.count({ where: { status: "COMPLETED", certificate: null } }),
  ]);
  return { total, revoked, last30, eligible };
}

const reasonSchema = z.string().trim().min(5, "Explique o motivo (mínimo de 5 caracteres)").max(300, "Máximo de 300 caracteres");

export async function revokeCertificate(id: string, reason: string) {
  const actor = await assertPermission("certificates.manage");
  const r = parseInput(z.object({ reason: reasonSchema }), { reason }).reason;
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert) throw new NotFoundError("Certificado não encontrado.");
  if (cert.revokedAt) throw new ValidationError("Este certificado já está revogado.");
  await db.certificate.update({ where: { id }, data: { revokedAt: new Date(), revokedReason: r } });
  await notify(cert.userId, {
    type: "CERTIFICATE",
    title: "Um certificado seu foi revogado",
    body: `${cert.courseTitle} — motivo: ${r}`.slice(0, 500),
    link: "/certificates",
  });
  await audit("certificate.revoked", { actorId: actor.id, entityType: "certificate", entityId: id, metadata: { code: cert.code, reason: r } });
}

export async function restoreCertificate(id: string) {
  const actor = await assertPermission("certificates.manage");
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert) throw new NotFoundError("Certificado não encontrado.");
  if (!cert.revokedAt) throw new ValidationError("Este certificado já está válido.");
  await db.certificate.update({ where: { id }, data: { revokedAt: null, revokedReason: null } });
  await notify(cert.userId, {
    type: "CERTIFICATE",
    title: "Seu certificado foi restaurado",
    body: `${cert.courseTitle} voltou a ser válido.`,
    link: "/certificates",
  });
  await audit("certificate.restored", { actorId: actor.id, entityType: "certificate", entityId: id, metadata: { code: cert.code } });
}

/** Matrículas concluídas ainda sem certificado (ex.: emissão automática desligada ou curso sem certificado). */
export async function eligibleEnrollments(q?: string) {
  await assertPermission("certificates.manage");
  return db.enrollment.findMany({
    where: {
      status: "COMPLETED",
      certificate: null,
      ...(q
        ? { OR: [{ user: { name: { contains: q, mode: "insensitive" } } }, { course: { title: { contains: q, mode: "insensitive" } } }] }
        : {}),
    },
    orderBy: { completedAt: "desc" },
    take: 50,
    select: {
      id: true,
      completedAt: true,
      user: { select: { name: true, email: true, avatarUrl: true } },
      course: { select: { title: true, certificateEnabled: true } },
    },
  });
}

export async function issueManually(enrollmentId: string) {
  const actor = await assertPermission("certificates.manage");
  const e = await db.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: { select: { certificateEnabled: true } }, certificate: true } });
  if (!e) throw new NotFoundError("Matrícula não encontrada.");
  if (e.certificate) throw new ValidationError("Esta matrícula já tem certificado.");
  if (e.status !== "COMPLETED") throw new ValidationError("Só é possível emitir para matrículas concluídas.");
  if (!e.course.certificateEnabled)
    throw new ValidationError("O curso está com certificado desativado. Ative o certificado nas configurações do curso para emitir.");
  const cert = await issueCertificate(enrollmentId);
  if (!cert) throw new ValidationError("Não foi possível emitir o certificado para esta matrícula.");
  await audit("certificate.issued_manually", { actorId: actor.id, entityType: "certificate", entityId: cert.id, metadata: { code: cert.code } });
  return cert.code;
}
