"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import * as svc from "@/server/services/admin-catalog";

const id = z.string().min(1).max(40);
function done() {
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

export async function saveCategoryAction(input: unknown) {
  return runAction("admin.category.save", async () => {
    const savedId = await svc.saveCategory(input);
    done();
    return savedId;
  }, "Categoria salva.");
}

export async function deleteCategoryAction(categoryId: string) {
  return runAction("admin.category.delete", async () => {
    const n = await svc.deleteCategory(parseInput(id, categoryId));
    done();
    return n;
  });
}

export async function reorderCategoriesAction(ids: string[]) {
  return runAction("admin.category.reorder", async () => {
    await svc.reorderCategories(parseInput(z.array(id).max(200), ids));
    done();
  }, "Ordem atualizada.");
}

export async function createTagAction(name: string) {
  return runAction("admin.tag.create", async () => {
    await svc.createTag(parseInput(z.string().max(60), name));
    done();
  }, "Tag criada.");
}

export async function renameTagAction(input: unknown) {
  return runAction("admin.tag.rename", async () => {
    const d = parseInput(z.object({ id, name: z.string().max(60) }), input);
    await svc.renameTag(d.id, d.name);
    done();
  }, "Tag renomeada.");
}

export async function deleteTagAction(tagId: string) {
  return runAction("admin.tag.delete", async () => {
    await svc.deleteTag(parseInput(id, tagId));
    done();
  }, "Tag excluída.");
}

export async function mergeTagsAction(input: unknown) {
  return runAction("admin.tag.merge", async () => {
    const d = parseInput(z.object({ sourceIds: z.array(id).min(1).max(100), targetId: id }), input);
    await svc.mergeTags(d.sourceIds, d.targetId);
    done();
  }, "Tags mescladas.");
}
