"use client";
import { Fragment, useMemo, useState } from "react";
import { Lock, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { SaveBar } from "../save-bar";
import { createRoleAction, deleteRoleAction, saveMatrixAction } from "@/app/(app)/admin/permissions/actions";

type Role = { id: string; key: string; name: string; description: string | null; isSystem: boolean; users: number; permissions: string[] };
type Group = { name: string; perms: { key: string; description: string }[] };

function toMatrix(roles: Role[]) {
  return Object.fromEntries(roles.map((r) => [r.id, [...r.permissions].sort()]));
}

export function PermissionMatrix({ roles, groups, locked }: { roles: Role[]; groups: Group[]; locked: string[] }) {
  const initial = useMemo(() => toMatrix(roles), [roles]);
  const [saved, setSaved] = useState(initial);
  const [matrix, setMatrix] = useState(initial);
  const [prevRoles, setPrevRoles] = useState(roles);
  // Recarrega a matriz quando os perfis mudam no servidor (criar/excluir perfil).
  if (prevRoles !== roles) {
    setPrevRoles(roles);
    setSaved(initial);
    setMatrix(initial);
  }
  const [mobileRole, setMobileRole] = useState(roles[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const confirm = useConfirm();
  const dirty = JSON.stringify(matrix) !== JSON.stringify(saved);
  const save = useAction(saveMatrixAction, {
    errorToast: true,
    onSuccess: (n) => {
      setSaved(matrix);
      toast.success(n ? `Permissões atualizadas em ${pluralize(n, "perfil", "perfis")}.` : "Nada mudou.");
    },
  });
  const del = useAction(deleteRoleAction, { errorToast: true });

  const isLocked = (r: Role, p: string) => r.key === "admin" && locked.includes(p);
  const has = (r: Role, p: string) => matrix[r.id]?.includes(p) ?? false;
  function toggle(r: Role, p: string, on: boolean) {
    if (isLocked(r, p)) return;
    setMatrix((m) => ({ ...m, [r.id]: (on ? [...m[r.id], p] : m[r.id].filter((x) => x !== p)).sort() }));
  }
  function toggleGroup(r: Role, g: Group, on: boolean) {
    setMatrix((m) => {
      const set = new Set(m[r.id]);
      for (const p of g.perms) {
        if (isLocked(r, p.key)) continue;
        if (on) set.add(p.key);
        else set.delete(p.key);
      }
      return { ...m, [r.id]: [...set].sort() };
    });
  }
  const changedRoles = roles.filter((r) => JSON.stringify(matrix[r.id]) !== JSON.stringify(saved[r.id]));

  function cell(r: Role, p: string) {
    const lock = isLocked(r, p);
    const box = (
      <Checkbox
        checked={has(r, p)}
        disabled={lock}
        onCheckedChange={(v) => toggle(r, p, v === true)}
        aria-label={`${r.name}: ${p}`}
        className={cn(lock && "disabled:opacity-60")}
      />
    );
    return lock ? (
      <Tooltip content="Obrigatória para o Administrador — evita que a plataforma fique sem quem gerencie permissões e configurações.">
        <span className="inline-flex items-center gap-1">{box}<Lock className="size-3 text-subtle" aria-hidden /></span>
      </Tooltip>
    ) : (
      box
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.run(Object.fromEntries(changedRoles.map((r) => [r.id, matrix[r.id]])));
      }}
    >
      {/* Perfis */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-h3">Perfis</h2>
        <Button type="button" variant="outline" onClick={() => setCreating(true)}><Plus /> Perfil personalizado</Button>
      </div>
      <ul className="mb-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((r) => (
          <li key={r.id} className="flex items-start gap-3 bg-surface p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{r.name}</p>
                {!r.isSystem && <Badge tone="accent">Personalizado</Badge>}
              </div>
              <p className="mt-1 inline-flex items-center gap-1.5 text-caption text-subtle">
                <Users className="size-3.5" aria-hidden /> {pluralize(r.users, "usuário", "usuários")} · {matrix[r.id]?.length ?? 0} permissões
              </p>
            </div>
            {!r.isSystem && (
              <Tooltip content={r.users ? "Remova os usuários deste perfil antes de excluir" : "Excluir perfil"}>
                <span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={r.users > 0 || del.pending}
                    aria-label={`Excluir perfil ${r.name}`}
                    onClick={async () => {
                      if (await confirm({ title: `Excluir o perfil "${r.name}"?`, description: "O perfil não tem usuários. Esta ação não pode ser desfeita.", confirmLabel: "Excluir perfil" }))
                        del.run(r.id);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </Tooltip>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-h3">Permissões</h2>
      {/* Desktop: matriz */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-xs md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr className="border-b border-border">
              <th className="h-11 px-5 text-left text-caption font-medium text-muted">Permissão</th>
              {roles.map((r) => (
                <th key={r.id} className={cn("h-11 w-28 px-2 text-center text-caption font-medium text-muted", changedRoles.includes(r) && "text-fg")}>
                  {r.name}
                  {changedRoles.includes(r) && <span className="ml-1 inline-block size-1.5 rounded-full bg-warning align-middle" aria-label="alterado" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.name}>
                <tr className="border-b border-border bg-surface-2/50">
                  <th scope="rowgroup" className="h-9 px-5 text-left text-overline text-subtle">{g.name}</th>
                  {roles.map((r) => {
                    const count = g.perms.filter((p) => has(r, p.key)).length;
                    return (
                      <td key={r.id} className="text-center">
                        <Checkbox
                          aria-label={`${r.name}: todas de ${g.name}`}
                          checked={count === g.perms.length ? true : count ? "indeterminate" : false}
                          onCheckedChange={(v) => toggleGroup(r, g, v === true)}
                          className="size-4"
                        />
                      </td>
                    );
                  })}
                </tr>
                {g.perms.map((p) => (
                  <tr key={p.key} className="border-b border-border last:border-b-0 hover:bg-surface-2/40">
                    <td className="px-5 py-2.5">
                      <p className="text-sm">{p.description}</p>
                      <p className="font-mono text-caption text-subtle">{p.key}</p>
                    </td>
                    {roles.map((r) => (
                      <td key={r.id} className="text-center">
                        {cell(r, p.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: um perfil por vez */}
      <div className="md:hidden">
        <Field label="Perfil">
          <NativeSelect value={mobileRole} onChange={(e) => setMobileRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </NativeSelect>
        </Field>
        {roles
          .filter((r) => r.id === mobileRole)
          .map((r) => (
            <div key={r.id} className="mt-4 space-y-4">
              {groups.map((g) => (
                <div key={g.name} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <p className="border-b border-border bg-surface-2/60 px-4 py-2 text-overline text-subtle">{g.name}</p>
                  <ul className="divide-y divide-border">
                    {g.perms.map((p) => (
                      <li key={p.key}>
                        <label className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                          {cell(r, p.key)}
                          <span className="text-sm">{p.description}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
      </div>

      <SaveBar dirty={dirty} pending={save.pending} onReset={() => setMatrix(saved)} label="Salvar permissões" />
      {creating && <CreateRoleDialog roles={roles} onClose={() => setCreating(false)} />}
    </form>
  );
}

function CreateRoleDialog({ roles, onClose }: { roles: Role[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [copyFrom, setCopyFrom] = useState(roles.find((r) => r.key === "student")?.id ?? "");
  const act = useAction(createRoleAction, { onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Novo perfil personalizado"
        description="Ex.: Monitor, Secretaria, Coordenador de turma. Depois ajuste as permissões na matriz e atribua o perfil em Usuários."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="role-form" loading={act.pending}>Criar perfil</Button>
          </>
        }
      >
        <form id="role-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); act.run({ name, description, copyFrom: copyFrom || undefined }); }}>
          <Field label="Nome" required error={act.fieldErrors.name}>
            <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Descrição" error={act.fieldErrors.description}>
            <Input value={description} maxLength={160} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Começar com as permissões de">
            <NativeSelect value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Nenhuma (vazio)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </NativeSelect>
          </Field>
          {act.error && !Object.keys(act.fieldErrors).length && <p className="text-small text-danger">{act.error}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
