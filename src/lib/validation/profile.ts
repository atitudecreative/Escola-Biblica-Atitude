import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  headline: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[\d\s()+-]*$/, "Use apenas números, espaços, parênteses e hífen")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(600, "Máximo de 600 caracteres").optional().or(z.literal("")),
  avatarUrl: z.string().regex(/^\/api\/files\/[a-z0-9]+$/i).nullable().optional(),
});

export const privacySchema = z.object({
  showInRanking: z.boolean(),
  showProgressToTeachers: z.boolean(),
  publicProfile: z.boolean(),
});
export type Privacy = z.infer<typeof privacySchema>;
export const DEFAULT_PRIVACY: Privacy = { showInRanking: true, showProgressToTeachers: true, publicProfile: false };
