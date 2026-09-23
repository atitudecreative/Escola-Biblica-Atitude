import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente validadas na inicialização.
 * Nenhum segredo é exposto ao cliente: apenas variáveis NEXT_PUBLIC_* chegam ao navegador.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET deve ter pelo menos 32 caracteres"),
  EMAIL_PROVIDER: z.enum(["log", "resend", "smtp"]).default("log"),
  EMAIL_FROM: z.string().default("Escola Bíblica Atitude <nao-responda@ibatitude.com.br>"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(200),
});

function load() {
  // No Render, sem APP_URL definido, usa a URL pública do serviço (RENDER_EXTERNAL_URL).
  const parsed = schema.safeParse({ ...process.env, APP_URL: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || undefined });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();
export const isProd = env.NODE_ENV === "production";
