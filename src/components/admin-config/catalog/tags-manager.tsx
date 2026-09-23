"use client";
import { useMemo, useState } from "react";
import { Combine, Hash, PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { useAction } from "@/hooks/use-action";
import { pluralize } from "@/lib/format";
import { createTagAction, deleteTagAction, mergeTagsAction, renameTagAction } from "@/app/(app)/admin/categories/actions";

export type TagRow = { id: string; name: string; slug: string; courses: number; lessons: number; users: number };

function usage(t: TagRow) {
  const parts = [t.courses && pluralize(t.courses, "curso", "cursos"), t.lessons && pluralize(t.lessons, "aula", "aulas"), t.users && pluralize(t.users, "usuário", "usuários")].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Sem uso";
}

export function TagsManager({ tags }: { tags: TagRow[] }) {
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<TagRow | null>(null);
  const [merging, setMerging] = useState(false);
  const confirm = useConfirm();
  const create = useAction(createTagAction, { onSuccess: () => setNewName("") });
  const del = useAction(deleteTagAction, { errorToast: true });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? tags.filter((t) => t.name.toLowerCase().includes(s) || t.slug.includes(s)) : tags;
  }, [q, tags]);
  const selectedTags = tags.filter((t) => selected.has(t.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function remove(t: TagRow) {
    const ok = await confirm({
      title: `Excluir a tag "${t.name}"?`,
      description: t.courses + t.lessons + t.users ? `Ela será removida de ${usage(t).toLowerCase()}. Os conteúdos continuam intactos.` : "A tag não está em uso.",
      confirmLabel: "Excluir tag",
    });
    if (ok) {
      const r = await del.run(t.id);
      if (r?.ok) setSelected((s) => { const n = new Set(s); n.delete(t.id); return n; });
    }
  }

  return (
    <section aria-labelledby="tags-title">
      <div className="mb-4">
        <h2 id="tags-title" className="text-h3">Tags</h2>
        <p className="mt-0.5 text-small text-muted">Palavras-chave de cursos e aulas. Selecione duas ou mais para mesclar duplicadas.</p>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) create.run(newName);
          }}
        >
          <div className="flex-1">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova tag (ex.: Antigo Testamento)" maxLength={40} aria-label="Nome da nova tag" aria-invalid={!!create.error || undefined} />
            {create.error && <p className="mt-1 text-caption font-medium text-danger">{create.fieldErrors.name ?? create.error}</p>}
          </div>
          <Button type="submit" variant="outline" loading={create.pending} disabled={!newName.trim()}>
            <Plus /> Criar
          </Button>
        </form>
        <div className="relative sm:w-60">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar tags" className="pl-9" aria-label="Filtrar tags" />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2">
          <span className="text-small font-medium">{selected.size} selecionada(s)</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
          <Button size="sm" className="ml-auto" disabled={selected.size < 2} onClick={() => setMerging(true)}>
            <Combine /> Mesclar
          </Button>
        </div>
      )}

      {tags.length === 0 ? (
        <EmptyState icon={Hash} title="Nenhuma tag" description="Crie tags aqui ou deixe os professores criá-las ao editar cursos." compact />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nenhuma tag encontrada" description={`Nada corresponde a "${q}".`} compact />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {filtered.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2 sm:px-4">
              <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Selecionar ${t.name}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="truncate text-caption text-subtle">{usage(t)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setRenaming(t)} aria-label={`Renomear ${t.name}`}>
                <PencilLine />
              </Button>
              <Button variant="ghost" size="icon" className="hover:text-danger" onClick={() => remove(t)} aria-label={`Excluir ${t.name}`}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {renaming && <RenameDialog tag={renaming} onClose={() => setRenaming(null)} />}
      {merging && (
        <MergeDialog
          tags={selectedTags}
          onClose={(done) => {
            setMerging(false);
            if (done) setSelected(new Set());
          }}
        />
      )}
    </section>
  );
}

function RenameDialog({ tag, onClose }: { tag: TagRow; onClose: () => void }) {
  const [name, setName] = useState(tag.name);
  const act = useAction(renameTagAction, { onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Renomear tag"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="rename-tag" loading={act.pending}>Salvar</Button>
          </>
        }
      >
        <form id="rename-tag" onSubmit={(e) => { e.preventDefault(); act.run({ id: tag.id, name }); }}>
          <Field label="Nome" error={act.fieldErrors.name ?? (act.error && !act.fieldErrors.name ? act.error : null)}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({ tags, onClose }: { tags: TagRow[]; onClose: (done: boolean) => void }) {
  const sorted = [...tags].sort((a, b) => b.courses + b.lessons - (a.courses + a.lessons));
  const [target, setTarget] = useState(sorted[0]?.id ?? "");
  const act = useAction(mergeTagsAction, { onSuccess: () => onClose(true), errorToast: true });
  const others = tags.filter((t) => t.id !== target);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent
        title={`Mesclar ${tags.length} tags`}
        description="Os cursos, aulas e usuários das outras tags passam para a tag escolhida. As outras tags são excluídas."
        footer={
          <>
            <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
            <Button loading={act.pending} onClick={() => act.run({ sourceIds: others.map((t) => t.id), targetId: target })}>
              <Combine /> Mesclar
            </Button>
          </>
        }
      >
        <Field label="Manter a tag">
          <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {usage(t)}</option>
            ))}
          </NativeSelect>
        </Field>
        <p className="mt-3 text-small text-muted">
          Serão removidas: <span className="font-medium text-fg">{others.map((t) => t.name).join(", ")}</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
