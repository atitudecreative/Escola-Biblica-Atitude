import "server-only";
import { headers } from "next/headers";
import { RateLimitError } from "@/server/errors";

/**
 * Rate limiting em memória (janela deslizante por chave).
 * Suficiente para uma instância. Para múltiplas instâncias, troque o `store`
 * por uma implementação em Redis mantendo a mesma interface.
 */
interface Store {
  hit(key: string, windowMs: number): number;
}

class MemoryStore implements Store {
  private hits = new Map<string, number[]>();
  hit(key: string, windowMs: number) {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (!v.some((t) => now - t < windowMs)) this.hits.delete(k);
    }
    return list.length;
  }
}

const globalStore = globalThis as unknown as { __rateStore?: Store };
const store = (globalStore.__rateStore ??= new MemoryStore());

export async function clientIp() {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  } catch {
    return "local";
  }
}

/** Lança RateLimitError quando `limit` é excedido na janela. */
export async function rateLimit(bucket: string, limit: number, windowMs: number, identity?: string) {
  const key = `${bucket}:${identity ?? (await clientIp())}`;
  if (store.hit(key, windowMs) > limit) throw new RateLimitError();
}
