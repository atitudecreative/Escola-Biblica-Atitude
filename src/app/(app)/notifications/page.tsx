import type { Metadata } from "next";
import type { NotificationType } from "@prisma/client";
import { requireUserPage } from "@/server/auth/guards";
import { listNotifications, unreadCount } from "@/server/services/notifications";
import { CONFIGURABLE_TYPES, EMAIL_CAPABLE_TYPES, getNotificationPrefs } from "@/server/services/preferences";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/ui/page-header";
import { NotificationCenter } from "@/components/communication/notification-center";
import { NotificationPreferences } from "@/components/communication/notification-preferences";
import { NOTIFICATION_TYPE } from "@/lib/labels";

export const metadata: Metadata = { title: "Notificações" };
const PAGE = 20;

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const unreadOnly = sp.filter === "unread";
  const type = typeof sp.type === "string" && sp.type in NOTIFICATION_TYPE ? (sp.type as NotificationType) : null;
  const [rows, unread, prefs, communication] = await Promise.all([
    listNotifications(user.id, { unreadOnly, types: type ? [type] : undefined, take: PAGE + 1 }),
    unreadCount(user.id),
    getNotificationPrefs(user.id),
    getSettings("communication"),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notificações"
        description={unread ? `Você tem ${unread} ${unread === 1 ? "notificação não lida" : "notificações não lidas"}.` : "Você está em dia."}
        actions={
          <NotificationPreferences
            initial={prefs}
            types={[...CONFIGURABLE_TYPES]}
            emailTypes={[...EMAIL_CAPABLE_TYPES]}
            emailEnabled={communication.emailNotifications}
            defaultOpen={sp.tab === "preferences"}
          />
        }
      />
      <NotificationCenter initial={rows.slice(0, PAGE)} initialHasMore={rows.length > PAGE} unreadOnly={unreadOnly} type={type} unreadTotal={unread} />
    </div>
  );
}
