import { assertPermission } from "@/server/auth/guards";
import { jsonError } from "@/server/http";
import { ValidationError } from "@/server/errors";
import { templateInput } from "@/server/services/admin-certificates";
import { renderCertificatePreviewPdf } from "@/server/services/certificates";
import { db } from "@/server/db";

/**
 * GET /api/admin/certificates/preview?templateId=… (modelo salvo)
 *  ou ?heading=&body=&signatureName=&signatureRole=&accentColor= (rascunho em edição)
 * Gera um PDF de exemplo com dados fictícios. Permissão: certificates.manage.
 */
export async function GET(req: Request) {
  try {
    await assertPermission("certificates.manage");
    const sp = new URL(req.url).searchParams;
    let template;
    const templateId = sp.get("templateId");
    if (templateId) {
      template = await db.certificateTemplate.findUnique({ where: { id: templateId } });
      if (!template) throw new ValidationError("Modelo não encontrado.");
    } else {
      const parsed = templateInput.safeParse({
        name: "Pré-visualização",
        heading: sp.get("heading") ?? "",
        body: sp.get("body") ?? "",
        signatureName: sp.get("signatureName") ?? "",
        signatureRole: sp.get("signatureRole") ?? "",
        accentColor: sp.get("accentColor") ?? "",
      });
      if (!parsed.success) throw new ValidationError("Preencha o modelo corretamente para gerar o exemplo.");
      template = parsed.data;
    }
    const bytes = await renderCertificatePreviewPdf(template);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="certificado-exemplo.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, "certificate_preview");
  }
}
