"use client";
import { useState } from "react";
import { CalendarClock, ImageIcon, MoreHorizontal, PencilLine, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { formatDateTime } from "@/lib/format";
import { SortableList } from "../sortable-list";
import { BannerPreview, type BannerDraft } from "./banner-preview";
import { deleteBannerAction, reorderBannersAction, saveBannerAction, toggleBannerAction } from "@/app/(app)/admin/banners/actions";

export type BannerRow = BannerDraft & { id: string; isActive: boolean; startsAt: string | null; endsAt: string | null };

const PLACEMENTS = {
  HOME_HERO: { label: "Banner principal da home", hint: "A home exibe só o primeiro banner ativo. Com imagem (ideal 1200×400), só a arte aparece, clicável; título e textos ficam apenas para leitores de tela." },
  DASHBOARD: { label: "Painel do aluno", hint: "Aviso em destaque no início da área logada." },
} as const;

function scheduleState(b: BannerRow, now: number) {
  if (!b.isActive) return { label: "Inativo", tone: "neutral" as const };
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return { label: "Agendado", tone: "info" as const };
  if (b.endsAt && new Date(b.endsAt).getTime() < now) return { label: "Expirado", tone: "warning" as const };
  return { label: "No ar", tone: "success" as const };
}

export function BannersManager({ banners, now }: { banners: BannerRow[]; now: number }) {
  const [editing, setEditing] = useState<BannerRow | { placement: BannerDraft["placement"] } | null>(null);
  return (
    <div className="space-y-10">
      {(Object.keys(PLACEMENTS) as BannerDraft["placement"][]).map((p) => (
        <PlacementList
          key={p}
          placement={p}
          banners={banners.filter((b) => b.placement === p)}
          now={now}
          onNew={() => setEditing({ placement: p })}
          onEdit={setEditing}
        />
      ))}
      {editing && <BannerDialog key={"id" in editing ? editing.id : `new-${editing.placement}`} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlacementList({
  placement,
  banners,
  now,
  onNew,
  onEdit,
}: {
  placement: BannerDraft["placement"];
  banners: BannerRow[];
  now: number;
  onNew: () => void;
  onEdit: (b: BannerRow) => void;
}) {
  const [items, setItems] = useState(banners);
  const [prevbanners, setPrevbanners] = useState(banners);
  if (prevbanners !== banners) {
    setPrevbanners(banners);
    setItems(banners);
  }
  const reorder = useAction(reorderBannersAction, { errorToast: true });
  const toggle = useAction(toggleBannerAction, { errorToast: true });
  const del = useAction(deleteBannerAction, { errorToast: true });
  const confirm = useConfirm();

  async function onReorder(ids: string[]) {
    const prev = items;
    setItems(ids.map((id) => items.find((i) => i.id === id)!));
    const r = await reorder.run({ placement, ids });
    if (!r?.ok) setItems(prev);
  }

  return (
    <section aria-labelledby={`pl-${placement}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`pl-${placement}`} className="text-h3">{PLACEMENTS[placement].label}</h2>
          <p className="mt-0.5 text-small text-muted">{PLACEMENTS[placement].hint} A ordem da lista é a ordem de exibição.</p>
        </div>
        <Button variant="outline" onClick={onNew}>
          <Plus /> Novo banner
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={ImageIcon}
          title="Nenhum banner aqui"
          description={placement === "HOME_HERO" ? "Sem banners, a home mostra uma mensagem padrão da Escola." : "Sem banners, o painel do aluno não exibe avisos."}
          action={<Button onClick={onNew}><Plus /> Criar banner</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          <SortableList
            items={items}
            onReorder={onReorder}
            disabled={reorder.pending}
            label="banner"
            className="divide-y divide-border"
            itemClassName="px-2 py-2.5 sm:px-3"
            renderItem={(b) => {
              const st = scheduleState(b, now);
              return (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => onEdit(b)} className="hidden h-14 w-24 shrink-0 overflow-hidden rounded-md bg-primary-soft ring-1 ring-border sm:block" aria-label={`Editar ${b.title}`}>
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura do banner
                      <img src={b.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-primary-soft-fg"><ImageIcon className="size-4" aria-hidden /></span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onEdit(b)} className="block max-w-full truncate text-left font-medium hover:underline">
                      {b.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge tone={st.tone} dot>{st.label}</Badge>
                      {(b.startsAt || b.endsAt) && (
                        <span className="inline-flex items-center gap-1 text-caption text-subtle">
                          <CalendarClock className="size-3.5" aria-hidden />
                          {b.startsAt ? formatDateTime(b.startsAt) : "agora"} → {b.endsAt ? formatDateTime(b.endsAt) : "sem fim"}
                        </span>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={b.isActive}
                    aria-label={b.isActive ? `Desativar ${b.title}` : `Ativar ${b.title}`}
                    onCheckedChange={async (v) => {
                      setItems((xs) => xs.map((x) => (x.id === b.id ? { ...x, isActive: v } : x)));
                      const r = await toggle.run({ id: b.id, isActive: v });
                      if (r?.ok) toast.success(v ? "Banner ativado." : "Banner desativado.");
                      else setItems((xs) => xs.map((x) => (x.id === b.id ? { ...x, isActive: !v } : x)));
                    }}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${b.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => onEdit(b)}>
                        <PencilLine /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        tone="danger"
                        onSelect={async () => {
                          if (await confirm({ title: "Excluir banner?", description: `"${b.title}" será removido definitivamente.`, confirmLabel: "Excluir" }))
                            del.run(b.id);
                        }}
                      >
                        <Trash2 /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            }}
          />
        </div>
      )}
    </section>
  );
}

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string) {
  return v ? new Date(v).toISOString() : null;
}

function BannerDialog({ initial, onClose }: { initial: BannerRow | { placement: BannerDraft["placement"] }; onClose: () => void }) {
  const existing = "id" in initial ? initial : null;
  const [b, setB] = useState({
    placement: initial.placement,
    eyebrow: existing?.eyebrow ?? "",
    title: existing?.title ?? "",
    subtitle: existing?.subtitle ?? "",
    ctaLabel: existing?.ctaLabel ?? "",
    ctaHref: existing?.ctaHref ?? "",
    imageUrl: existing?.imageUrl ?? "",
    isActive: existing?.isActive ?? true,
    startsAt: toLocalInput(existing?.startsAt ?? null),
    endsAt: toLocalInput(existing?.endsAt ?? null),
  });
  const set = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => setB((x) => ({ ...x, [k]: v }));
  const act = useAction(saveBannerAction, { onSuccess: onClose });
  const fe = act.fieldErrors;
  const external = /^https:\/\//.test(b.ctaHref);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        title={existing ? "Editar banner" : "Novo banner"}
        description="A pré-visualização mostra como o banner aparece para os visitantes."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="banner-form" loading={act.pending}>{existing ? "Salvar banner" : "Criar banner"}</Button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <form
            id="banner-form"
            className="grid content-start gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              act.run({ ...b, id: existing?.id, startsAt: fromLocalInput(b.startsAt), endsAt: fromLocalInput(b.endsAt) });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Onde exibir" error={fe.placement}>
                <NativeSelect value={b.placement} onChange={(e) => set("placement", e.target.value as BannerDraft["placement"])}>
                  <option value="HOME_HERO">Banner principal da home</option>
                  <option value="DASHBOARD">Painel do aluno</option>
                </NativeSelect>
              </Field>
              <Field label="Chamada (eyebrow)" error={fe.eyebrow} hint="Opcional, acima do título.">
                <Input value={b.eyebrow} maxLength={60} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Ex.: Inscrições abertas" />
              </Field>
            </div>
            <Field label="Título" required error={fe.title}>
              <Input value={b.title} maxLength={120} onChange={(e) => set("title", e.target.value)} autoFocus={!existing} />
            </Field>
            <Field label="Subtítulo" error={fe.subtitle}>
              <Textarea value={b.subtitle} maxLength={240} rows={2} onChange={(e) => set("subtitle", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
              <Field label="Texto do botão" error={fe.ctaLabel}>
                <Input value={b.ctaLabel} maxLength={40} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="Explorar cursos" />
              </Field>
              <Field
                label="Link do botão"
                error={fe.ctaHref}
                hint={b.ctaHref ? (external ? "Link externo: abre em nova aba." : "Link interno da plataforma.") : "Caminho interno (/courses) ou https://"}
              >
                <Input value={b.ctaHref} maxLength={300} onChange={(e) => set("ctaHref", e.target.value.trim())} placeholder="/courses" inputMode="url" />
              </Field>
            </div>
            <div>
              <p className="mb-1.5 text-small font-medium">Imagem de fundo</p>
              {b.imageUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do upload */}
                  <img src={b.imageUrl} alt="" className="h-12 w-20 rounded object-cover" />
                  <p className="min-w-0 flex-1 text-small text-muted">Imagem enviada. O texto fica em branco sobre um véu escuro.</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("imageUrl", "")}>
                    <X /> Remover
                  </Button>
                </div>
              ) : (
                <FileDropzone purpose="banner" accept="image/jpeg,image/png,image/webp" compact hint="JPG, PNG ou WebP até 6 MB · ideal 1920×800" onUploaded={(f) => set("imageUrl", f.url)} />
              )}
              {fe.imageUrl && <p className="mt-1 text-caption font-medium text-danger">{fe.imageUrl}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Exibir a partir de" error={fe.startsAt} hint="Vazio = imediatamente">
                <Input type="datetime-local" value={b.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              </Field>
              <Field label="Exibir até" error={fe.endsAt} hint="Vazio = sem data de término">
                <Input type="datetime-local" value={b.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span>
                <span className="block text-sm font-medium">Banner ativo</span>
                <span className="block text-caption text-subtle">Desative para esconder sem excluir.</span>
              </span>
              <Switch checked={b.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </label>
            {act.error && !Object.keys(fe).length && <p className="text-small text-danger">{act.error}</p>}
          </form>
          <div className="lg:sticky lg:top-0 lg:self-start">
            <p className="mb-2 text-overline text-subtle">Pré-visualização</p>
            <BannerPreview b={b} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
