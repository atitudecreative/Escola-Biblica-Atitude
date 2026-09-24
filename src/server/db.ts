import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Sem `connection_limit` na URL, o Prisma abre (núcleos × 2 + 1) conexões por processo —
 * em máquinas de nuvem isso estoura poolers como o do Supabase (15 clientes). Padrão: 5.
 * No `next build` (pré-renderização em vários workers, enquanto a versão anterior segue
 * no ar usando o mesmo pooler) cada worker fica com 1 conexão.
 */
function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (process.env.NEXT_PHASE === "phase-production-build") url.searchParams.set("connection_limit", "1");
    else if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5");
    return url.toString();
  } catch {
    return raw;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Sempre um único cliente por processo: além do hot reload em dev, no build/produção
// cada rota pode carregar sua própria cópia deste módulo — sem isso, cada cópia abriria
// um pool próprio e multiplicaria as conexões.
globalForPrisma.prisma = db;
