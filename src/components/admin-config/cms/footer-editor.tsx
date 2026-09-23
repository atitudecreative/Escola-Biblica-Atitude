"use client";
import { Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useAction } from "@/hooks/use-action";
import { SortableList } from "../sortable-list";
import { SaveBar } from "../save-bar";
import { useDirtyForm } from "../use-dirty-form";
import { saveFooterAction } from "@/app/(app)/admin/banners/actions";

export type FooterSettings = { text: string; links: { label: string; href: string }[]; instagram: string; youtube: string };

let uid = 0;
export function FooterEditor({ initial }: { initial: FooterSettings }) {
  const form = useDirtyForm({ ...initial, links: initial.links.map((l) => ({ ...l, id: `l${++uid}` })) });
  const v = form.values;
  const act = useAction(saveFooterAction, { errorToast: true, onSuccess: () => form.commit() });
  const fe = act.fieldErrors;
  const patch = (i: number, p: Partial<{ label: string; href: string }>) => form.set("links", v.links.map((l, j) => (j === i ? { ...l, ...p } : l)));

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        act.run({ ...v, links: v.links.map(({ label, href }) => ({ label, href })) });
      }}
    >
      <section className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
        <Field label="Texto do rodapé" error={fe.text} hint="Uma frase curta sobre a Escola.">
          <Textarea value={v.text} maxLength={300} rows={2} onChange={(e) => form.set("text", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram" error={fe.instagram}>
            <Input value={v.instagram} maxLength={200} placeholder="https://instagram.com/…" inputMode="url" onChange={(e) => form.set("instagram", e.target.value.trim())} />
          </Field>
          <Field label="YouTube" error={fe.youtube}>
            <Input value={v.youtube} maxLength={200} placeholder="https://youtube.com/@…" inputMode="url" onChange={(e) => form.set("youtube", e.target.value.trim())} />
          </Field>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-h3">Links do rodapé</h2>
            <p className="mt-0.5 text-small text-muted">Até 12. Caminhos internos (/courses) ou endereços https://.</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={v.links.length >= 12} onClick={() => form.set("links", [...v.links, { label: "", href: "", id: `l${++uid}` }])}>
            <Plus /> Adicionar link
          </Button>
        </div>
        {v.links.length === 0 ? (
          <EmptyState compact icon={Link2} title="Sem links" description="Adicione atalhos como Catálogo ou Validar certificado." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <SortableList
              items={v.links}
              label="link"
              onReorder={(ids) => form.set("links", ids.map((id) => v.links.find((l) => l.id === id)!))}
              className="divide-y divide-border"
              itemClassName="px-2 py-2.5 sm:px-3"
              renderItem={(l, i) => (
                <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-start">
                  <Field error={fe[`links.${i}.label`]}>
                    <Input aria-label="Rótulo" placeholder="Rótulo" value={l.label} maxLength={40} onChange={(e) => patch(i, { label: e.target.value })} required />
                  </Field>
                  <Field error={fe[`links.${i}.href`]}>
                    <Input aria-label="Endereço" placeholder="/courses" value={l.href} maxLength={300} onChange={(e) => patch(i, { href: e.target.value.trim() })} required />
                  </Field>
                  <Button type="button" variant="danger-ghost" size="icon" aria-label="Remover link" onClick={() => form.set("links", v.links.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            />
          </div>
        )}
      </section>
      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} label="Salvar rodapé" />
    </form>
  );
}
