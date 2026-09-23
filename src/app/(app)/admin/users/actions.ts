"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import * as svc from "@/server/services/users-admin";

const id = z.string().min(1).max(40);

function done() {
  revalidatePath("/admin/users");
  revalidatePath("/admin/students", "layout");
  revalidatePath("/admin/teachers", "layout");
}

export async function createUserAction(input: unknown) {
  return runAction("admin.user.create", async () => {
    const res = await svc.createUser(parseInput(svc.createUserSchema, input));
    done();
    return res;
  });
}

export async function updateUserAction(input: unknown) {
  return runAction(
    "admin.user.update",
    async () => {
      await svc.updateUser(parseInput(svc.updateUserSchema, input));
      done();
    },
    "Alterações salvas.",
  );
}

const statusInput = z.object({ ids: z.array(id).min(1).max(200), status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]) });

export async function setUsersStatusAction(input: unknown) {
  return runAction("admin.user.status", async () => {
    const d = parseInput(statusInput, input);
    const res = await svc.setUsersStatus(d.ids, d.status);
    done();
    return res;
  });
}

export async function sendResetLinkAction(userId: unknown) {
  return runAction("admin.user.reset", async () => svc.sendResetLink(parseInput(id, userId)));
}
