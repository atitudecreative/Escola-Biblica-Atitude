import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { env } from "@/server/env";

/** Proteção CSRF para Route Handlers mutáveis: exige Origin igual ao host. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new AppError("Origem da requisição ausente.", "BAD_ORIGIN", 403);
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("Origem inválida.", "BAD_ORIGIN", 403);
  }
  if (originHost !== host && originHost !== new URL(env.APP_URL).host) {
    throw new AppError("Origem não permitida.", "BAD_ORIGIN", 403);
  }
}

export function jsonError(error: unknown, name: string) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  logger.error(`route.${name}.failed`, { error, category: "app" });
  return NextResponse.json({ error: "Erro inesperado. Tente novamente." }, { status: 500 });
}
