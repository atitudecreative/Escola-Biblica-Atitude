import "server-only";
import { NextResponse } from "next/server";
import { storage } from "@/server/storage";

/** Resposta de arquivo com suporte a Range (vídeo/áudio: busca sem baixar tudo). */
export async function fileResponse(req: Request, storageKey: string, headers: Record<string, string>) {
  const size = await storage.size(storageKey);
  const base = { ...headers, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
  const m = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = await storage.stream(storageKey, { start, end });
    return new NextResponse(stream, {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = await storage.stream(storageKey);
  return new NextResponse(stream, { headers: { ...base, "Content-Length": String(size) } });
}
