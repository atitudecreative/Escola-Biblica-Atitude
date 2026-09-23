import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { requirePermissionPage } from "@/server/auth/guards";
import { emailProviderInfo } from "@/server/services/admin-settings";
import { CommunicationForm } from "@/components/admin-config/settings/settings-forms";

export const metadata: Metadata = { title: "Comunicação · Configurações" };

export default async function CommunicationSettingsPage() {
  await requirePermissionPage("settings.manage");
  return <CommunicationForm initial={await getSettings("communication")} provider={emailProviderInfo()} />;
}
