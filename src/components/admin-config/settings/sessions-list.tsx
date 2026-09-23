"use client";
import { RelativeTime } from "@/components/ui/relative-time";
import { MonitorSmartphone } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm";
import { useAction } from "@/hooks/use-action";
import {formatNumber} from "@/lib/format";
import { describeUserAgent } from "./user-agent";
import { revokeSessionAction } from "@/app/(app)/admin/settings/actions";

type SessionRow = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
};

export function SessionsList({ sessions, total, currentSessionId }: { sessions: SessionRow[]; total: number; currentSessionId: string }) {
  const confirm = useConfirm();
  const act = useAction(revokeSessionAction, { errorToast: true });
  return (
    <section className="mb-8">
      <h2 className="text-h3">Sessões ativas</h2>
      <p className="mt-0.5 text-small text-muted">
        {formatNumber(total)} sessão(ões) aberta(s) na plataforma{total > sessions.length ? `; mostrando as ${sessions.length} usadas mais recentemente` : ""}. Encerrar desconecta a pessoa naquele dispositivo.
      </p>
      {sessions.length === 0 ? (
        <EmptyState className="mt-4" compact icon={MonitorSmartphone} title="Nenhuma sessão ativa" />
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {sessions.map((s) => {
            const current = s.id === currentSessionId;
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={s.user.name} src={s.user.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    <span className="truncate">{s.user.name}</span>
                    {current && <Badge tone="primary">Esta sessão</Badge>}
                  </p>
                  <p className="truncate text-caption text-subtle">
                    {describeUserAgent(s.userAgent)}
                    {s.ip ? ` · ${s.ip}` : ""} · ativa <RelativeTime date={s.lastUsedAt} />
                  </p>
                </div>
                {!current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger-soft"
                    disabled={act.pending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Encerrar sessão?",
                        description: `${s.user.name} será desconectado(a) em ${describeUserAgent(s.userAgent)} e precisará entrar novamente.`,
                        confirmLabel: "Encerrar sessão",
                      });
                      if (ok) act.run(s.id);
                    }}
                  >
                    Encerrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
