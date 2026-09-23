import "server-only";

/**
 * Logger estruturado (JSON em uma linha) — pronto para ser coletado por
 * qualquer agregador (Datadog, Loki, CloudWatch). A categoria distingue:
 *  - user:  erro causado por entrada/ação do usuário (validação, permissão)
 *  - app:   bug ou estado inesperado da aplicação
 *  - infra: falha de dependência externa (banco, e-mail, storage)
 */
type Level = "debug" | "info" | "warn" | "error";
export type ErrorCategory = "user" | "app" | "infra";

function write(level: Level, message: string, context: Record<string, unknown> = {}) {
  const entry = { ts: new Date().toISOString(), level, message, ...context };
  const line = JSON.stringify(entry, (_k, v) =>
    v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v,
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level !== "debug" || process.env.NODE_ENV !== "production") console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown> & { category?: ErrorCategory }) =>
    write("error", msg, { category: "app", ...ctx }),
};
