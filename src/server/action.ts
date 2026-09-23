import "server-only";
import { z } from "zod";
import { AppError, ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";
import { unstable_rethrow } from "next/navigation";

/**
 * Contrato padrão de retorno das Server Actions.
 * A UI recebe sempre uma mensagem amigável; detalhes técnicos ficam no log.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodFieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ValidationError(undefined, zodFieldErrors(parsed.error));
  return parsed.data;
}

/** Executa a lógica e converte exceções em ActionResult. Redirecionamentos do Next passam direto. */
export async function runAction<T>(
  name: string,
  fn: () => Promise<T>,
  successMessage?: string,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: successMessage };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) {
      if (error.status >= 500) logger.error(`action.${name}`, { error, category: "app" });
      else logger.info(`action.${name}.rejected`, { code: error.code, category: "user" });
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    logger.error(`action.${name}.failed`, { error, category: "app" });
    return { ok: false, error: "Algo deu errado do nosso lado. Tente novamente em instantes." };
  }
}
