import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { requirePermissionPage } from "@/server/auth/guards";
import { CoursesForm } from "@/components/admin-config/settings/settings-forms";

export const metadata: Metadata = { title: "Cursos · Configurações" };

export default async function CoursesSettingsPage() {
  await requirePermissionPage("settings.manage");
  return <CoursesForm initial={await getSettings("courses")} />;
}
