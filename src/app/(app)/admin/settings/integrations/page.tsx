import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { requirePermissionPage } from "@/server/auth/guards";
import { listWebhookDeliveries, listWebhooks } from "@/server/services/admin-settings";
import { WEBHOOK_EVENTS } from "@/server/services/webhooks";
import { AnalyticsForm } from "@/components/admin-config/settings/settings-forms";
import { WebhooksManager } from "@/components/admin-config/settings/webhooks-manager";
import { PreparedIntegrations } from "@/components/admin-config/settings/prepared-integrations";

export const metadata: Metadata = { title: "Integrações · Configurações" };

export default async function IntegrationsSettingsPage() {
  await requirePermissionPage("settings.manage");
  const [integrations, webhooks, deliveries] = await Promise.all([
    getSettings("integrations"),
    listWebhooks(),
    listWebhookDeliveries({ page: 1, pageSize: 10 }),
  ]);
  return (
    <>
      <AnalyticsForm initial={integrations} />
      <WebhooksManager
        events={WEBHOOK_EVENTS.map((e) => ({ key: e.key, label: e.label }))}
        endpoints={webhooks.map((w) => ({
          id: w.id,
          url: w.url,
          events: w.events,
          isActive: w.isActive,
          secretHint: w.secretHint,
          deliveries: w._count.deliveries,
          last: w.last ? { statusCode: w.last.statusCode, error: w.last.error, createdAt: w.last.createdAt.toISOString() } : null,
        }))}
        deliveries={deliveries.rows.map((d) => ({
          id: d.id,
          event: d.event,
          statusCode: d.statusCode,
          error: d.error,
          createdAt: d.createdAt.toISOString(),
          url: d.endpoint.url,
        }))}
        totalDeliveries={deliveries.total}
      />
      <PreparedIntegrations />
    </>
  );
}
