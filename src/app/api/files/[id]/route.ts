import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { canReadFile } from "@/server/services/files";
import { fileResponse } from "@/server/file-response";
import { logger } from "@/server/logger";

/**
 * GET /api/files/:id — entrega arquivos com autorização e suporte a Range
 * (necessário para vídeo/áudio: busca no player sem baixar tudo).
 * ?download=1 força o download.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  const { file, allowed } = await canReadFile(user, id);
  if (!file) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: user ? "Sem permissão para este arquivo." : "Entre para acessar." }, { status: user ? 403 : 401 });

  try {
    const download = new URL(req.url).searchParams.get("download") === "1";
    const inlineSafe = /^(image\/(png|jpeg|webp)|application\/pdf|video\/|audio\/|text\/vtt)/.test(file.mimeType);
    const disposition = `${download || !inlineSafe ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`;
    return await fileResponse(req, file.storageKey, {
      "Content-Type": file.mimeType,
      "Content-Disposition": disposition,
      "Cache-Control": file.visibility === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, max-age=3600",
      // SVG e demais tipos não executam scripts mesmo se abertos diretamente.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    });
  } catch (error) {
    logger.error("files.read_failed", { id, error, category: "infra" });
    return NextResponse.json({ error: "Arquivo indisponível no momento." }, { status: 503 });
  }
}
