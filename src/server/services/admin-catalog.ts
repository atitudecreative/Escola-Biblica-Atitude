import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertPermission } from "@/server/auth/guards";
import { NotFoundError, ValidationError } from "@/server/errors";
import { parseInput } from "@/server/action";
import { slugify } from "@/lib/utils";
import { CATALOG_ICON_KEYS } from "@/components/admin-config/icon-keys";

/** Categorias e tags do catálogo. Permissão: categories.manage. */

const slugSchema = z
  .string()
  .trim()
  .min(2, "Mínimo de 2 caracteres")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens");

export const categoryInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome").max(60, "Máximo de 60 caracteres"),
  slug: slugSchema,
  description: z.string().trim().max(240, "Máximo de 240 caracteres").optional().default(""),
  icon: z.enum(CATALOG_ICON_KEYS).nullable().optional(),
});

export async function listCategories() {
  await assertPermission("categories.manage");
  return db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { courses: true } } },
  });
}

export async function saveCategory(input: unknown) {
  const actor = await assertPermission("categories.manage");
  const data = parseInput(categoryInput, input);
  const clash = await db.category.findFirst({ where: { slug: data.slug, ...(data.id ? { id: { not: data.id } } : {}) }, select: { id: true } });
  if (clash) throw new ValidationError("Já existe uma categoria com este slug.", { slug: "Slug já utilizado por outra categoria" });
  const values = { name: data.name, slug: data.slug, description: data.description || null, icon: data.icon ?? null };
  if (data.id) {
    const exists = await db.category.findUnique({ where: { id: data.id }, select: { id: true } });
    if (!exists) throw new NotFoundError("Categoria não encontrada.");
    await db.category.update({ where: { id: data.id }, data: values });
    await audit("category.updated", { actorId: actor.id, entityType: "category", entityId: data.id, metadata: { name: data.name } });
    return data.id;
  }
  const last = await db.category.aggregate({ _max: { position: true } });
  const created = await db.category.create({ data: { ...values, position: (last._max.position ?? -1) + 1 } });
  await audit("category.created", { actorId: actor.id, entityType: "category", entityId: created.id, metadata: { name: data.name } });
  return created.id;
}

export async function deleteCategory(id: string) {
  const actor = await assertPermission("categories.manage");
  const cat = await db.category.findUnique({ where: { id }, include: { _count: { select: { courses: true } } } });
  if (!cat) throw new NotFoundError("Categoria não encontrada.");
  // onDelete: SetNull — os cursos ficam "sem categoria".
  await db.category.delete({ where: { id } });
  await audit("category.deleted", { actorId: actor.id, entityType: "category", entityId: id, metadata: { name: cat.name, courses: cat._count.courses } });
  return cat._count.courses;
}

export async function reorderCategories(ids: string[]) {
  const actor = await assertPermission("categories.manage");
  const existing = await db.category.findMany({ select: { id: true } });
  const set = new Set(existing.map((c) => c.id));
  if (ids.length !== set.size || !ids.every((id) => set.has(id))) throw new ValidationError("A lista de categorias mudou. Recarregue a página.");
  await db.$transaction(ids.map((id, position) => db.category.update({ where: { id }, data: { position } })));
  await audit("category.reordered", { actorId: actor.id, entityType: "category" });
}

// ── Tags ─────────────────────────────────────────────

export async function listTags() {
  await assertPermission("categories.manage");
  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { courses: true, lessons: true, users: true } } },
  });
  return tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug, courses: t._count.courses, lessons: t._count.lessons, users: t._count.users }));
}

const tagName = z.string().trim().min(2, "Mínimo de 2 caracteres").max(40, "Máximo de 40 caracteres");

export async function createTag(name: string) {
  const actor = await assertPermission("categories.manage");
  const n = parseInput(z.object({ name: tagName }), { name }).name;
  const slug = slugify(n);
  if (!slug) throw new ValidationError("Nome inválido.", { name: "Use letras ou números" });
  if (await db.tag.findUnique({ where: { slug } })) throw new ValidationError("Esta tag já existe.", { name: "Já existe uma tag com este nome" });
  const tag = await db.tag.create({ data: { name: n, slug } });
  await audit("tag.created", { actorId: actor.id, entityType: "tag", entityId: tag.id, metadata: { name: n } });
  return tag.id;
}

export async function renameTag(id: string, name: string) {
  const actor = await assertPermission("categories.manage");
  const n = parseInput(z.object({ name: tagName }), { name }).name;
  const slug = slugify(n);
  const clash = await db.tag.findFirst({ where: { slug, id: { not: id } }, select: { id: true } });
  if (clash) throw new ValidationError("Já existe uma tag com este nome. Use \"Mesclar\" para unificá-las.", { name: "Nome já utilizado" });
  const tag = await db.tag.findUnique({ where: { id } });
  if (!tag) throw new NotFoundError("Tag não encontrada.");
  await db.tag.update({ where: { id }, data: { name: n, slug } });
  await audit("tag.renamed", { actorId: actor.id, entityType: "tag", entityId: id, metadata: { from: tag.name, to: n } });
}

export async function deleteTag(id: string) {
  const actor = await assertPermission("categories.manage");
  const tag = await db.tag.findUnique({ where: { id } });
  if (!tag) throw new NotFoundError("Tag não encontrada.");
  await db.tag.delete({ where: { id } });
  await audit("tag.deleted", { actorId: actor.id, entityType: "tag", entityId: id, metadata: { name: tag.name } });
}

/** Mescla `sourceIds` em `targetId`: move os vínculos (sem duplicar) e remove as tags de origem. */
export async function mergeTags(sourceIds: string[], targetId: string) {
  const actor = await assertPermission("categories.manage");
  const sources = sourceIds.filter((id) => id !== targetId);
  if (!sources.length) throw new ValidationError("Escolha ao menos uma tag diferente da tag de destino.");
  const target = await db.tag.findUnique({ where: { id: targetId } });
  if (!target) throw new NotFoundError("Tag de destino não encontrada.");
  await db.$transaction(async (tx) => {
    const [courses, lessons, users] = await Promise.all([
      tx.courseTag.findMany({ where: { tagId: { in: sources } } }),
      tx.lessonTag.findMany({ where: { tagId: { in: sources } } }),
      tx.userTag.findMany({ where: { tagId: { in: sources } } }),
    ]);
    if (courses.length)
      await tx.courseTag.createMany({ data: courses.map((c) => ({ courseId: c.courseId, tagId: targetId })), skipDuplicates: true });
    if (lessons.length)
      await tx.lessonTag.createMany({ data: lessons.map((l) => ({ lessonId: l.lessonId, tagId: targetId })), skipDuplicates: true });
    if (users.length) await tx.userTag.createMany({ data: users.map((u) => ({ userId: u.userId, tagId: targetId })), skipDuplicates: true });
    await tx.tag.deleteMany({ where: { id: { in: sources } } });
  });
  await audit("tag.merged", { actorId: actor.id, entityType: "tag", entityId: targetId, metadata: { merged: sources } });
}
