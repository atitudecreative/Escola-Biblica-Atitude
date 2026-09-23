import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { requirePermissionPage } from "@/server/auth/guards";
import { AppearanceForm } from "@/components/admin-config/settings/settings-forms";

export const metadata: Metadata = { title: "Aparência · Configurações" };

export default async function AppearanceSettingsPage() {
  await requirePermissionPage("settings.manage");
  return <AppearanceForm initial={await getSettings("appearance")} />;
}
