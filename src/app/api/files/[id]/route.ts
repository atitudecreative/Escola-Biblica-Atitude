import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { canReadFile } from "@/server/services/files";
import { storage } from "@/server/storage";
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
    const size = await storage.size(file.storageKey);
    const download = new URL(req.url).searchParams.get("download") === "1";
    const inlineSafe = /^(image\/(png|jpeg|webp)|application\/pdf|video\/|audio\/|text\/vtt)/.test(file.mimeType);
    const disposition = `${download || !inlineSafe ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`;
    const base: Record<string, string> = {
      "Content-Type": file.mimeType,
      "Content-Disposition": disposition,
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": file.visibility === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, max-age=3600",
      // SVG e demais tipos não executam scripts mesmo se abertos diretamente.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    };

    const range = req.headers.get("range");
    const m = range?.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const stream = await storage.stream(file.storageKey, { start, end });
      return new NextResponse(stream, {
        status: 206,
        headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
      });
    }
    const stream = await storage.stream(file.storageKey);
    return new NextResponse(stream, { headers: { ...base, "Content-Length": String(size) } });
  } catch (error) {
    logger.error("files.read_failed", { id, error, category: "infra" });
    return NextResponse.json({ error: "Arquivo indisponível no momento." }, { status: 503 });
  }
}
