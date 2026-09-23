import "server-only";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import type { Prisma } from "@prisma/client";

/**
 * Trilha de auditoria de ações sensíveis. Falhas ao auditar nunca
 * interrompem a operação principal, mas são registradas no log.
 */
export async function audit(
  action: string,
  opts: { actorId?: string | null; entityType?: string; entityId?: string; metadata?: Prisma.InputJsonValue } = {},
) {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
    } catch {
      // fora de um contexto de requisição (ex.: seed)
    }
    await db.auditLog.create({
      data: {
        action,
        actorId: opts.actorId ?? null,
        entityType: opts.entityType,
        entityId: opts.entityId,
        metadata: opts.metadata ?? {},
        ip,
        userAgent,
      },
    });
  } catch (error) {
    logger.error("audit.write_failed", { action, error, category: "infra" });
  }
}
