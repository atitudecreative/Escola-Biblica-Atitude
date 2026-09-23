import { Cloud, CreditCard, KeyRound, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ITEMS = [
  {
    icon: MessageCircle,
    title: "WhatsApp",
    text: "Envio de avisos e lembretes por WhatsApp Business API.",
    where: "Adicionar um canal em src/server/services/notifications.ts (ao lado do e-mail) com as credenciais do provedor em variáveis de ambiente.",
  },
  {
    icon: KeyRound,
    title: "Login com Google / Microsoft",
    text: "Entrar com conta Google ou Microsoft 365.",
    where: "A tabela oauth_accounts já existe. Falta registrar o app OAuth no provedor e implementar o fluxo em src/server/services/auth.ts.",
  },
  {
    icon: Cloud,
    title: "Armazenamento S3 / R2",
    text: "Guardar vídeos e materiais em nuvem em vez do disco do servidor.",
    where: "Implementar a interface StorageDriver em src/server/storage e selecionar com STORAGE_DRIVER.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos",
    text: "Cursos pagos com Stripe, Mercado Pago ou Pagar.me.",
    where: "Pedidos, itens e cupons já estão modelados (orders, coupons). Falta o gateway: checkout e webhook de confirmação.",
  },
];

/** Integrações com estrutura pronta, mas sem provedor ativo. Sem botões falsos. */
export function PreparedIntegrations() {
  return (
    <section className="mb-8">
      <h2 className="text-h3">Preparado para</h2>
      <p className="mt-0.5 text-small text-muted">A arquitetura já prevê estas integrações. Elas exigem credenciais externas e desenvolvimento pontual antes de funcionar.</p>
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        {ITEMS.map((it) => (
          <li key={it.title} className="flex gap-3 px-4 py-4 sm:px-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
              <it.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{it.title}</p>
                <Badge tone="neutral">Não configurado</Badge>
              </div>
              <p className="mt-0.5 text-small text-muted">{it.text}</p>
              <p className="mt-1.5 text-caption text-subtle">Onde plugar: {it.where}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
