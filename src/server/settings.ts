import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/server/db";

/**
 * Configurações da plataforma (CMS). Cada grupo é um documento JSON validado
 * por Zod. Valores ausentes caem nos padrões, então adicionar um novo campo
 * nunca quebra dados já salvos.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB");
const link = z.object({ label: z.string().min(1).max(40), href: z.string().min(1).max(300) });

export const settingsSchemas = {
  general: z.object({
    platformName: z.string().min(2).max(60).default("Escola Bíblica Atitude"),
    shortName: z.string().min(2).max(20).default("EBA"),
    tagline: z.string().max(120).default("Formação bíblica para uma fé que transforma"),
    description: z
      .string()
      .max(400)
      .default(
        "Cursos de Bíblia, teologia, liderança e vida cristã com professores da Igreja Batista Atitude. Estude no seu ritmo, com acompanhamento e certificado.",
      ),
    logoUrl: z.string().max(500).nullable().default(null),
    contactEmail: z.string().email().or(z.literal("")).default("escola@ibatitude.com.br"),
    contactPhone: z.string().max(30).default(""),
  }),
  appearance: z.object({
    primaryColor: hex.default("#1F5B4B"),
    accentColor: hex.default("#B7832F"),
    defaultTheme: z.enum(["system", "light", "dark"]).default("system"),
    headingFont: z.enum(["serif", "sans"]).default("serif"),
  }),
  home: z.object({
    sections: z
      .object({
        featured: z.boolean().default(true),
        categories: z.boolean().default(true),
        continue: z.boolean().default(true),
        popular: z.boolean().default(true),
        newest: z.boolean().default(true),
        teachers: z.boolean().default(true),
        testimonials: z.boolean().default(true),
        benefits: z.boolean().default(true),
        cta: z.boolean().default(true),
      })
      .default({
        featured: true,
        categories: true,
        continue: true,
        popular: true,
        newest: true,
        teachers: true,
        testimonials: true,
        benefits: true,
        cta: true,
      }),
    featuredCourseIds: z.array(z.string()).max(12).default([]),
    testimonials: z
      .array(z.object({ name: z.string().max(60), role: z.string().max(80), quote: z.string().max(400) }))
      .max(9)
      .default([]),
    benefits: z
      .array(z.object({ icon: z.string().max(40), title: z.string().max(60), text: z.string().max(200) }))
      .max(6)
      .default([]),
    ctaTitle: z.string().max(100).default("Comece hoje sua jornada de formação"),
    ctaText: z.string().max(240).default("Crie sua conta gratuita e tenha acesso aos cursos abertos da Escola."),
  }),
  users: z.object({
    allowRegistration: z.boolean().default(true),
    requireEmailVerification: z.boolean().default(false),
  }),
  courses: z.object({
    requireReview: z.boolean().default(true),
    allowSelfEnrollment: z.boolean().default(true),
    autoIssueCertificates: z.boolean().default(true),
    certificatePrefix: z.string().regex(/^[A-Z]{2,6}$/, "Use de 2 a 6 letras maiúsculas").default("EBA"),
  }),
  communication: z.object({
    emailNotifications: z.boolean().default(true),
    supportEnabled: z.boolean().default(true),
    emailSignature: z.string().max(300).default("Equipe Escola Bíblica Atitude"),
  }),
  security: z.object({
    minPasswordLength: z.number().int().min(8).max(64).default(8),
    maxLoginAttempts: z.number().int().min(3).max(50).default(8),
    twoFactorEnabled: z.boolean().default(false),
  }),
  integrations: z.object({
    gaMeasurementId: z.string().regex(/^(G-[A-Z0-9]+)?$/, "Formato esperado: G-XXXXXXX").default(""),
    metaPixelId: z.string().regex(/^\d*$/, "Somente números").default(""),
  }),
  footer: z.object({
    text: z.string().max(300).default("Uma iniciativa da Igreja Batista Atitude."),
    links: z.array(link).max(12).default([
      { label: "Catálogo", href: "/courses" },
      { label: "Validar certificado", href: "/certificate" },
      { label: "Entrar", href: "/login" },
    ]),
    instagram: z.string().max(200).default(""),
    youtube: z.string().max(200).default(""),
  }),
} as const;

export type SettingsGroup = keyof typeof settingsSchemas;
export type Settings<G extends SettingsGroup> = z.infer<(typeof settingsSchemas)[G]>;

export const getSettings = cache(async <G extends SettingsGroup>(group: G): Promise<Settings<G>> => {
  const row = await db.setting.findUnique({ where: { key: group } });
  const parsed = settingsSchemas[group].safeParse(row?.value ?? {});
  if (parsed.success) return parsed.data as Settings<G>;
  // Dados corrompidos: usa os padrões em vez de derrubar a página.
  return settingsSchemas[group].parse({}) as Settings<G>;
});

export async function saveSettings<G extends SettingsGroup>(group: G, value: unknown, actorId: string) {
  const data = settingsSchemas[group].parse(value);
  await db.setting.upsert({
    where: { key: group },
    create: { key: group, value: data as object, updatedById: actorId },
    update: { value: data as object, updatedById: actorId },
  });
  return data as Settings<G>;
}
