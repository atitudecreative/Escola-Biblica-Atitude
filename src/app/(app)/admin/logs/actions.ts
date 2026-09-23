"use server";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import { getEmailContent } from "@/server/services/admin-logs";

export async function getEmailAction(id: string) {
  return runAction("admin.logs.email", async () => {
    const m = await getEmailContent(parseInput(z.string().min(1).max(40), id));
    return { ...m, createdAt: m.createdAt.toISOString() };
  });
}
