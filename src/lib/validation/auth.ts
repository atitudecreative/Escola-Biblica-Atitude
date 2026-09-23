import { z } from "zod";

export const email = z
  .string({ error: "Informe seu e-mail" })
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail")
  .max(254)
  .email("E-mail inválido");

export const password = z
  .string({ error: "Informe uma senha" })
  .min(8, "A senha precisa ter pelo menos 8 caracteres")
  .max(128, "A senha pode ter no máximo 128 caracteres")
  .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
  .regex(/\d/, "Inclua ao menos um número");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha").max(128),
  remember: z.boolean().default(false),
  next: z.string().optional(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo").max(80),
  email,
  password,
  acceptTerms: z.literal(true, { error: "É preciso aceitar os termos para continuar" }),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ token: z.string().min(20), password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });

export const changePasswordSchema = z
  .object({ current: z.string().min(1, "Informe a senha atual"), password, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });

/** Força da senha para feedback visual (0–4). */
export function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}
