import { NextResponse } from "next/server";
import { renderCertificatePdf } from "@/server/services/certificates";
import { rateLimit } from "@/server/rate-limit";
import { jsonError } from "@/server/http";

/**
 * GET /api/certificates/:code/pdf — PDF do certificado.
 * Público de propósito: o código funciona como chave de validação (como o QR Code),
 * e o certificado não contém dados sensíveis além de nome, curso e carga horária.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/certificates/[code]/pdf">) {
  try {
    await rateLimit("cert:pdf", 60, 60_000);
    const { code } = await ctx.params;
    if (!/^[A-Z]{2,6}-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code)) {
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }
    const result = await renderCertificatePdf(code);
    if (!result) return NextResponse.json({ error: "Certificado não encontrado." }, { status: 404 });
    return new NextResponse(Buffer.from(result.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificado-${result.cert.code}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return jsonError(error, "certificate_pdf");
  }
}
