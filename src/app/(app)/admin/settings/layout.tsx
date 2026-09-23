import { requirePermissionPage } from "@/server/auth/guards";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsNav } from "@/components/admin-config/settings/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePermissionPage("settings.manage");
  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Identidade, aparência, regras e integrações da plataforma." />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SettingsNav />
        </aside>
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </>
  );
}
