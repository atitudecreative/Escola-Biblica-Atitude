"use client";
import { useState } from "react";
import Link from "next/link";
import { Copy, KeyRound, MoreHorizontal, PencilLine, Plus, Send, Trash2, Webhook } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { formatNumber, timeAgo } from "@/lib/format";
import { deleteWebhookAction, rotateWebhookSecretAction, saveWebhookAction, testWebhookAction } from "@/app/(app)/admin/settings/actions";

type EventOpt = { key: string; label: string };
type Endpoint = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secretHint: string;
  deliveries: number;
  last: { statusCode: number | null; error: string | null; createdAt: string } | null;
};
type Delivery = { id: string; event: string; statusCode: number | null; error: string | null; createdAt: string; url: string };

export function DeliveryStatus({ statusCode, error }: { statusCode: number | null; error: string | null }) {
  if (statusCode && statusCode >= 200 && statusCode < 300) return <Badge tone="success" dot>{statusCode}</Badge>;
  if (statusCode) return <Badge tone="danger" dot>{statusCode}</Badge>;
  return (
    <span title={error ?? undefined}>
      <Badge tone="danger" dot>Falhou</Badge>
    </span>
  );
}

export function WebhooksManager({ events, endpoints, deliveries, totalDeliveries }: { events: EventOpt[]; endpoints: Endpoint[]; deliveries: Delivery[]; totalDeliveries: number }) {
  const [editing, setEditing] = useState<Endpoint | "new" | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const labelOf = (k: string) => events.find((e) => e.key === k)?.label ?? k;

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-h3">Webhooks</h2>
          <p className="mt-0.5 text-small text-muted">
            Enviamos um POST JSON para cada endpoint inscrito no evento, assinado com <span className="font-mono text-caption">X-EBA-Signature</span> (HMAC-SHA256 do corpo com o segredo).
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing("new")}><Plus /> Novo endpoint</Button>
      </div>

      {endpoints.length === 0 ? (
        <EmptyState
          className="mt-4"
          compact
          icon={Webhook}
          title="Nenhum endpoint"
          description="Conecte automações (Zapier, Make, n8n ou um sistema próprio) a eventos como matrícula e certificado emitido."
          action={<Button onClick={() => setEditing("new")}><Plus /> Adicionar endpoint</Button>}
        />
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {endpoints.map((ep) => (
            <EndpointRow key={ep.id} ep={ep} labelOf={labelOf} onEdit={() => setEditing(ep)} onSecret={setSecret} />
          ))}
        </ul>
      )}

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-h4">Entregas recentes</h3>
          {totalDeliveries > deliveries.length && (
            <Link href="/admin/logs?tab=webhooks" className="text-small font-medium text-primary hover:underline">
              Ver histórico completo ({formatNumber(totalDeliveries)})
            </Link>
          )}
        </div>
        {deliveries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4 py-5 text-center text-small text-muted">Nenhuma entrega ainda. Use “Enviar teste” para validar um endpoint.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-small">
                <DeliveryStatus statusCode={d.statusCode} error={d.error} />
                <span className="font-mono text-caption">{d.event}</span>
                <span className="hidden min-w-0 flex-1 truncate text-subtle sm:block">{d.url}</span>
                <span className="ml-auto shrink-0 text-caption text-subtle">{timeAgo(d.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <EndpointDialog
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          events={events}
          onClose={() => setEditing(null)}
          onCreated={setSecret}
        />
      )}
      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
    </section>
  );
}

function EndpointRow({ ep, labelOf, onEdit, onSecret }: { ep: Endpoint; labelOf: (k: string) => string; onEdit: () => void; onSecret: (s: string) => void }) {
  const confirm = useConfirm();
  const [result, setResult] = useState<{ ok: boolean; statusCode: number | null; error: string | null } | null>(null);
  const test = useAction(testWebhookAction, {
    errorToast: true,
    onSuccess: (r) => {
      setResult(r);
      if (r.ok) toast.success(`Teste entregue: HTTP ${r.statusCode}.`);
      else toast.error(r.statusCode ? `O endpoint respondeu HTTP ${r.statusCode}.` : `Falha na entrega: ${r.error ?? "sem resposta"}.`);
    },
  });
  const rotate = useAction(rotateWebhookSecretAction, { errorToast: true, onSuccess: onSecret });
  const del = useAction(deleteWebhookAction, { errorToast: true });

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-mono text-small font-medium">{ep.url}</p>
            {!ep.isActive && <Badge tone="neutral">Pausado</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ep.events.map((e) => (
              <Badge key={e} tone="neutral">{labelOf(e)}</Badge>
            ))}
          </div>
          <p className="mt-2 text-caption text-subtle">
            Segredo {ep.secretHint} · {formatNumber(ep.deliveries)} entrega(s)
            {ep.last ? ` · última ${timeAgo(ep.last.createdAt)}` : ""}
          </p>
          {result && (
            <p className={result.ok ? "mt-1 text-caption font-medium text-success" : "mt-1 text-caption font-medium text-danger"} role="status">
              Teste: {result.statusCode ? `HTTP ${result.statusCode}` : result.error ?? "sem resposta"}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" loading={test.pending} onClick={() => test.run(ep.id)}>
            <Send /> <span className="hidden sm:inline">Enviar teste</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Mais ações"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onEdit}><PencilLine /> Editar</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  if (await confirm({ title: "Gerar novo segredo?", description: "O segredo atual deixa de valer imediatamente. Atualize o sistema que recebe os webhooks com o novo valor.", confirmLabel: "Gerar novo segredo" }))
                    rotate.run(ep.id);
                }}
              >
                <KeyRound /> Gerar novo segredo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                tone="danger"
                onSelect={async () => {
                  if (await confirm({ title: "Excluir endpoint?", description: `${ep.url} deixará de receber eventos. O histórico de entregas também será removido.`, confirmLabel: "Excluir" }))
                    del.run(ep.id);
                }}
              >
                <Trash2 /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

function EndpointDialog({ initial, events, onClose, onCreated }: { initial: Endpoint | null; events: EventOpt[]; onClose: () => void; onCreated: (s: string) => void }) {
  const [url, setUrl] = useState(initial?.url ?? "https://");
  const [selected, setSelected] = useState<string[]>(initial?.events ?? []);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const act = useAction(saveWebhookAction, {
    onSuccess: (r) => {
      toast.success(initial ? "Endpoint atualizado." : "Endpoint criado.");
      onClose();
      if (r.secret) onCreated(r.secret);
    },
  });
  const fe = act.fieldErrors;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={initial ? "Editar endpoint" : "Novo endpoint"}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="wh-form" loading={act.pending}>{initial ? "Salvar" : "Criar endpoint"}</Button>
          </>
        }
      >
        <form id="wh-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); act.run({ id: initial?.id, url, events: selected, isActive }); }}>
          <Field label="URL" required error={fe.url} hint="Precisa ser https://. O endpoint deve responder 2xx em até 8 segundos.">
            <Input value={url} maxLength={500} inputMode="url" onChange={(e) => setUrl(e.target.value.trim())} className="font-mono" autoFocus />
          </Field>
          <fieldset>
            <legend className="text-small font-medium">Eventos</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {events.map((ev) => (
                <label key={ev.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 hover:bg-surface-2/60">
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.includes(ev.key)}
                    onCheckedChange={(v) => setSelected((s) => (v === true ? [...s, ev.key] : s.filter((x) => x !== ev.key)))}
                  />
                  <span>
                    <span className="block text-sm">{ev.label}</span>
                    <span className="block font-mono text-caption text-subtle">{ev.key}</span>
                  </span>
                </label>
              ))}
            </div>
            {fe.events && <p className="mt-1.5 text-caption font-medium text-danger">{fe.events}</p>}
          </fieldset>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium">Ativo</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
          {act.error && !Object.keys(fe).length && <p className="text-small text-danger">{act.error}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SecretDialog({ secret, onClose }: { secret: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Segredo do webhook" description="Copie e guarde agora. Por segurança, ele não será exibido novamente." footer={<Button onClick={onClose}>Já copiei</Button>}>
        <div className="flex gap-2">
          <Input readOnly value={secret ?? ""} className="font-mono text-caption" onFocus={(e) => e.currentTarget.select()} aria-label="Segredo" />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(secret ?? "");
                toast.success("Segredo copiado.");
              } catch {
                toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
              }
            }}
          >
            <Copy /> Copiar
          </Button>
        </div>
        <Alert tone="info" className="mt-4">
          Para validar: calcule HMAC-SHA256 do corpo bruto da requisição com este segredo e compare (em hexadecimal) com o header X-EBA-Signature.
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
