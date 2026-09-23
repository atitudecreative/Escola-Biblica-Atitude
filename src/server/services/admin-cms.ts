import "server-only";
import { z } from "zod";
import type { BannerPlacement } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertPermission } from "@/server/auth/guards";
import { NotFoundError, ValidationError } from "@/server/errors";
import { parseInput } from "@/server/action";

/** Banners (slider da home e do dashboard). Permissão: banners.manage. */

/** Link interno ("/rota") ou externo https — nada de javascript:, // ou http inseguro. */
export const ctaHrefSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => {
      if (v.startsWith("/")) return !v.startsWith("//") && !v.startsWith("/\\");
      try {
        const u = new URL(v);
        return u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Use um caminho interno (ex.: /courses) ou um endereço https://" },
  );

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Data inválida" });
      return z.NEVER;
    }
    return d;
  });

export const bannerInput = z
  .object({
    id: z.string().optional(),
    placement: z.enum(["HOME_HERO", "DASHBOARD"]),
    eyebrow: z.string().trim().max(60, "Máximo de 60 caracteres").optional().default(""),
    title: z.string().trim().min(3, "Informe o título").max(120, "Máximo de 120 caracteres"),
    subtitle: z.string().trim().max(240, "Máximo de 240 caracteres").optional().default(""),
    ctaLabel: z.string().trim().max(40, "Máximo de 40 caracteres").optional().default(""),
    ctaHref: z.union([z.literal(""), ctaHrefSchema]).optional().default(""),
    imageUrl: z
      .string()
      .trim()
      .max(500)
      .regex(/^\/api\/files\/[A-Za-z0-9_-]+$/, "Envie a imagem pelo campo de upload")
      .or(z.literal(""))
      .optional()
      .default(""),
    isActive: z.boolean().default(true),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .superRefine((b, ctx) => {
    if (b.ctaLabel && !b.ctaHref) ctx.addIssue({ code: "custom", path: ["ctaHref"], message: "Informe o link do botão" });
    if (b.ctaHref && !b.ctaLabel) ctx.addIssue({ code: "custom", path: ["ctaLabel"], message: "Informe o rótulo do botão" });
    if (b.startsAt && b.endsAt && b.endsAt <= b.startsAt)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O fim precisa ser depois do início" });
  });

export async function listBanners() {
  await assertPermission("banners.manage");
  return db.banner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }, { createdAt: "asc" }] });
}

export async function saveBanner(input: unknown) {
  const actor = await assertPermission("banners.manage");
  const b = parseInput(bannerInput, input);
  const data = {
    placement: b.placement as BannerPlacement,
    eyebrow: b.eyebrow || null,
    title: b.title,
    subtitle: b.subtitle || null,
    ctaLabel: b.ctaLabel || null,
    ctaHref: b.ctaHref || null,
    imageUrl: b.imageUrl || null,
    isActive: b.isActive,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
  };
  if (b.id) {
    const existing = await db.banner.findUnique({ where: { id: b.id } });
    if (!existing) throw new NotFoundError("Banner não encontrado.");
    // Mudou de posição (home ↔ dashboard): vai para o fim da nova lista.
    const position =
      existing.placement === data.placement
        ? existing.position
        : ((await db.banner.aggregate({ where: { placement: data.placement }, _max: { position: true } }))._max.position ?? -1) + 1;
    await db.banner.update({ where: { id: b.id }, data: { ...data, position } });
    await audit("banner.updated", { actorId: actor.id, entityType: "banner", entityId: b.id, metadata: { title: b.title } });
    return b.id;
  }
  const last = await db.banner.aggregate({ where: { placement: data.placement }, _max: { position: true } });
  const created = await db.banner.create({ data: { ...data, position: (last._max.position ?? -1) + 1 } });
  await audit("banner.created", { actorId: actor.id, entityType: "banner", entityId: created.id, metadata: { title: b.title } });
  return created.id;
}

export async function setBannerActive(id: string, isActive: boolean) {
  const actor = await assertPermission("banners.manage");
  const res = await db.banner.updateMany({ where: { id }, data: { isActive } });
  if (!res.count) throw new NotFoundError("Banner não encontrado.");
  await audit(isActive ? "banner.activated" : "banner.deactivated", { actorId: actor.id, entityType: "banner", entityId: id });
}

export async function deleteBanner(id: string) {
  const actor = await assertPermission("banners.manage");
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) throw new NotFoundError("Banner não encontrado.");
  await db.banner.delete({ where: { id } });
  await audit("banner.deleted", { actorId: actor.id, entityType: "banner", entityId: id, metadata: { title: b.title } });
}

export async function reorderBanners(placement: BannerPlacement, ids: string[]) {
  const actor = await assertPermission("banners.manage");
  const existing = await db.banner.findMany({ where: { placement }, select: { id: true } });
  const set = new Set(existing.map((e) => e.id));
  if (ids.length !== set.size || !ids.every((id) => set.has(id))) throw new ValidationError("A lista de banners mudou. Recarregue a página.");
  await db.$transaction(ids.map((id, position) => db.banner.update({ where: { id }, data: { position } })));
  await audit("banner.reordered", { actorId: actor.id, entityType: "banner", metadata: { placement } });
}

/** Cursos publicados para escolher os destaques da home. */
export async function publishedCoursesForPicker() {
  await assertPermission("banners.manage");
  return db.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { title: "asc" },
    select: { id: true, title: true, coverUrl: true, instructor: { select: { name: true } }, category: { select: { name: true } } },
  });
}
