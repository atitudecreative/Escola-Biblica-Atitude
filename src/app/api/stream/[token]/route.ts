import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSessionUser } from "@/server/auth/session";
import { readMediaToken } from "@/server/media-token";
import { fileResponse } from "@/server/file-response";
import { logger } from "@/server/logger";

/**
 * GET /api/stream/:token — vídeo das aulas, só dentro do player da plataforma.
 * Exige: token válido e não expirado, sessão do mesmo aluno para quem foi emitido
 * e requisição feita pelo elemento <video> da própria página (abrir o endereço
 * numa aba, baixar ou embutir em outro site é recusado).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/stream/[token]">) {
  const { token } = await ctx.params;
  const denied = (status: number) =>
    new NextResponse("Este vídeo só pode ser assistido dentro da plataforma da Escola.", {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });

  const payload = readMediaToken(token);
  if (!payload) return denied(403);
  const user = await getSessionUser();
  if (!user || user.id !== payload.u) return denied(403);

  // Navegadores informam quem pediu: só o elemento <video> da própria plataforma passa —
  // abrir em aba/janela, baixar, fetch pelo console ou embutir em outro site é recusado.
  const dest = req.headers.get("sec-fetch-dest");
  const site = req.headers.get("sec-fetch-site");
  if ((dest && dest !== "video") || (site && site !== "same-origin")) return denied(403);

  const file = await db.fileAsset.findUnique({ where: { id: payload.f }, select: { storageKey: true, mimeType: true } });
  if (!file || !file.mimeType.startsWith("video/")) return denied(404);

  try {
    return await fileResponse(req, file.storageKey, {
      "Content-Type": file.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
  } catch (error) {
    logger.error("stream.read_failed", { error, category: "infra" });
    return NextResponse.json({ error: "Vídeo indisponível no momento." }, { status: 503 });
  }
}
