"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import * as svc from "@/server/services/admin-certificates";

const id = z.string().min(1).max(40);
const done = () => revalidatePath("/admin/certificates");

export async function saveTemplateAction(input: unknown) {
  return runAction("admin.cert_template.save", async () => {
    const r = await svc.saveTemplate(input);
    done();
    return r;
  }, "Modelo salvo.");
}

export async function setDefaultTemplateAction(templateId: string) {
  return runAction("admin.cert_template.default", async () => {
    await svc.setDefaultTemplate(parseInput(id, templateId));
    done();
  }, "Modelo padrão atualizado.");
}

export async function deleteTemplateAction(templateId: string) {
  return runAction("admin.cert_template.delete", async () => {
    await svc.deleteTemplate(parseInput(id, templateId));
    done();
  }, "Modelo excluído.");
}

export async function revokeCertificateAction(input: unknown) {
  return runAction("admin.certificate.revoke", async () => {
    const d = parseInput(z.object({ id, reason: z.string().max(400) }), input);
    await svc.revokeCertificate(d.id, d.reason);
    done();
  }, "Certificado revogado. O aluno foi notificado.");
}

export async function restoreCertificateAction(certId: string) {
  return runAction("admin.certificate.restore", async () => {
    await svc.restoreCertificate(parseInput(id, certId));
    done();
  }, "Certificado restaurado.");
}

export async function issueCertificateAction(enrollmentId: string) {
  return runAction("admin.certificate.issue", async () => {
    const code = await svc.issueManually(parseInput(id, enrollmentId));
    done();
    return code;
  });
}
