"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/action";
import * as cms from "@/server/services/admin-cms";
import { saveSettingsGroup } from "@/server/services/admin-settings";

const id = z.string().min(1).max(40);
function done() {
  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
}

export async function saveBannerAction(input: unknown) {
  return runAction("admin.banner.save", async () => {
    const r = await cms.saveBanner(input);
    done();
    return r;
  }, "Banner salvo.");
}

export async function toggleBannerAction(input: unknown) {
  return runAction("admin.banner.toggle", async () => {
    const d = parseInput(z.object({ id, isActive: z.boolean() }), input);
    await cms.setBannerActive(d.id, d.isActive);
    done();
    return d.isActive;
  });
}

export async function deleteBannerAction(bannerId: string) {
  return runAction("admin.banner.delete", async () => {
    await cms.deleteBanner(parseInput(id, bannerId));
    done();
  }, "Banner excluído.");
}

export async function reorderBannersAction(input: unknown) {
  return runAction("admin.banner.reorder", async () => {
    const d = parseInput(z.object({ placement: z.enum(["HOME_HERO", "DASHBOARD"]), ids: z.array(id).max(100) }), input);
    await cms.reorderBanners(d.placement, d.ids);
    done();
  }, "Ordem dos banners atualizada.");
}

export async function saveHomeAction(input: unknown) {
  return runAction("admin.settings.home", async () => {
    await saveSettingsGroup("home", input);
    done();
  }, "Home atualizada.");
}

export async function saveFooterAction(input: unknown) {
  return runAction("admin.settings.footer", async () => {
    await saveSettingsGroup("footer", input);
    done();
  }, "Rodapé atualizado.");
}
