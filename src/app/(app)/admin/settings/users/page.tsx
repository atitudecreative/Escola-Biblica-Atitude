import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { requirePermissionPage } from "@/server/auth/guards";
import { UsersForm } from "@/components/admin-config/settings/settings-forms";

export const metadata: Metadata = { title: "Usuários · Configurações" };

export default async function UsersSettingsPage() {
  await requirePermissionPage("settings.manage");
  return <UsersForm initial={await getSettings("users")} />;
}
