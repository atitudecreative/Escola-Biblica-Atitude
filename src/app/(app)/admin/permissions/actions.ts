"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import * as svc from "@/server/services/admin-roles";

function done() {
  revalidatePath("/admin/permissions");
  revalidatePath("/", "layout");
}

export async function saveMatrixAction(input: unknown) {
  return runAction("admin.roles.matrix", async () => {
    const n = await svc.saveRoleMatrix(input);
    done();
    return n;
  });
}

export async function createRoleAction(input: unknown) {
  return runAction("admin.roles.create", async () => {
    const id = await svc.createCustomRole(input);
    done();
    return id;
  }, "Perfil criado. Atribua-o a usuários em Usuários.");
}

export async function deleteRoleAction(roleId: string) {
  return runAction("admin.roles.delete", async () => {
    await svc.deleteCustomRole(parseInput(z.string().min(1).max(40), roleId));
    done();
  }, "Perfil excluído.");
}
