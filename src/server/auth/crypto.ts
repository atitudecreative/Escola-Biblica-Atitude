import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/** Token opaco de alta entropia (256 bits), seguro para URL. */
export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens são persistidos apenas como hash: um vazamento do banco não expõe sessões. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Argon2id com parâmetros recomendados pela OWASP (m=19MiB, t=2, p=1).
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, ARGON_OPTS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Hash descartável usado para igualar o tempo de resposta quando o e-mail não existe
// (evita enumeração de contas por timing).
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword("timing-equalizer-password");
  await verifyPassword(await dummyHash, password);
}
