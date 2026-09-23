import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { requirePermissionPage } from "@/server/auth/guards";
import { GeneralForm } from "@/components/admin-config/settings/settings-forms";

export const metadata: Metadata = { title: "Configurações gerais" };

export default async function GeneralSettingsPage() {
  await requirePermissionPage("settings.manage");
  return <GeneralForm initial={await getSettings("general")} />;
}
