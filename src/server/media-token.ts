import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/**
 * Tokens de reprodução de vídeo: assinados (HMAC), ligados ao aluno e com validade curta.
 * O endereço do vídeo muda a cada carregamento da aula, não funciona para outra pessoa
 * e expira — copiar o link não serve para compartilhar a aula.
 */
const TTL_MS = 3 * 60 * 60 * 1000;

type Payload = { f: string; u: string; e: number };

function sign(data: string) {
  return createHmac("sha256", `media:${env.SESSION_SECRET}`).update(data).digest("base64url");
}

export function createMediaToken(fileId: string, userId: string) {
  const body = Buffer.from(JSON.stringify({ f: fileId, u: userId, e: Date.now() + TTL_MS } satisfies Payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readMediaToken(token: string): Payload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (typeof p.f !== "string" || typeof p.u !== "string" || typeof p.e !== "number" || p.e < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}
