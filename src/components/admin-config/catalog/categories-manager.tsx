"use client";
import { useEffect, useState } from "react";
import { FolderTree, MoreHorizontal, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { pluralize } from "@/lib/format";
import { slugify } from "@/lib/utils";
import { SortableList } from "../sortable-list";
import { IconPicker } from "../icon-picker";
import { CatalogIcon } from "../icons";
import { deleteCategoryAction, reorderCategoriesAction, saveCategoryAction } from "@/app/(app)/admin/categories/actions";

export type CategoryRow = { id: string; name: string; slug: string; description: string | null; icon: string | null; courses: number };

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const [items, setItems] = useState(categories);
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  const confirm = useConfirm();
  const reorder = useAction(reorderCategoriesAction, { errorToast: true });
  const del = useAction(deleteCategoryAction, { errorToast: true });

  useEffect(() => setItems(categories), [categories]);

  async function onReorder(ids: string[]) {
    const prev = items;
    setItems(ids.map((id) => items.find((i) => i.id === id)!));
    const r = await reorder.run(ids);
    if (!r?.ok) setItems(prev);
  }

  async function remove(c: CategoryRow) {
    const ok = await confirm({
      title: `Excluir "${c.name}"?`,
      description: c.courses
        ? `${pluralize(c.courses, "curso usa", "cursos usam")} esta categoria. Eles não serão excluídos: ficarão "sem categoria" até você escolher outra.`
        : "A categoria não tem cursos vinculados.",
      confirmLabel: "Excluir categoria",
    });
    if (!ok) return;
    const r = await del.run(c.id);
    if (r?.ok) toast.success(c.courses ? `Categoria excluída. ${pluralize(c.courses, "curso ficou", "cursos ficaram")} sem categoria.` : "Categoria excluída.");
  }

  return (
    <section aria-labelledby="cat-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="cat-title" className="text-h3">Categorias</h2>
          <p className="mt-0.5 text-small text-muted">A ordem abaixo é a ordem exibida no catálogo e na home. Arraste ou use as setas.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus /> Nova categoria
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="Nenhuma categoria"
          description="Categorias organizam o catálogo e ajudam os alunos a encontrar cursos."
          action={<Button onClick={() => setEditing("new")}><Plus /> Criar a primeira</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          <SortableList
            items={items}
            onReorder={onReorder}
            disabled={reorder.pending}
            label="categoria"
            className="divide-y divide-border"
            itemClassName="px-2 py-2.5 sm:px-3"
            renderItem={(c) => (
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                  <CatalogIcon name={c.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-caption text-subtle">
                    /{c.slug} · {pluralize(c.courses, "curso", "cursos")}
                    {c.description ? <span className="hidden sm:inline"> · {c.description}</span> : null}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${c.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setEditing(c)}>
                      <PencilLine /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem tone="danger" onSelect={() => remove(c)}>
                      <Trash2 /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          />
        </div>
      )}

      <CategoryDialog
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        category={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </section>
  );
}

function CategoryDialog({ category, open, onOpenChange }: { category: CategoryRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [description, setDescription] = useState(category?.description ?? "");
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const act = useAction(saveCategoryAction, { onSuccess: () => onOpenChange(false) });
  const fe = act.fieldErrors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={category ? "Editar categoria" : "Nova categoria"}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" form="category-form" loading={act.pending}>
              {category ? "Salvar" : "Criar categoria"}
            </Button>
          </>
        }
      >
        <form
          id="category-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            act.run({ id: category?.id, name, slug, description, icon });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Nome" required error={fe.name}>
              <Input
                value={name}
                maxLength={60}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="Ícone" error={fe.icon}>
              <IconPicker value={icon} onChange={setIcon} />
            </Field>
          </div>
          <Field label="Slug (endereço)" required error={fe.slug} hint={`Aparece na URL: /courses?category=${slug || "…"}`}>
            <Input
              value={slug}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
            />
          </Field>
          <Field label="Descrição" error={fe.description} hint="Opcional. Uma frase curta exibida no catálogo.">
            <Textarea value={description} maxLength={240} rows={3} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {act.error && !Object.keys(fe).length && <p className="text-small text-danger">{act.error}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
