import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { requirePermissionPage } from "@/server/auth/guards";
import { listActiveSessions } from "@/server/services/admin-settings";
import { SecurityForm } from "@/components/admin-config/settings/settings-forms";
import { SessionsList } from "@/components/admin-config/settings/sessions-list";

export const metadata: Metadata = { title: "Segurança · Configurações" };

export default async function SecuritySettingsPage() {
  const user = await requirePermissionPage("settings.manage");
  const [security, sessions] = await Promise.all([getSettings("security"), listActiveSessions()]);
  return (
    <>
      <SecurityForm initial={security} />
      <SessionsList
        total={sessions.total}
        currentSessionId={user.sessionId}
        sessions={sessions.rows.map((s) => ({
          id: s.id,
          ip: s.ip,
          userAgent: s.userAgent,
          createdAt: s.createdAt.toISOString(),
          lastUsedAt: s.lastUsedAt.toISOString(),
          user: s.user,
        }))}
      />
    </>
  );
}
