"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { useAction } from "@/hooks/use-action";
import {
  createUserAction,
  updateUserAction,
} from "@/app/(app)/admin/users/actions";
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import type { EditableUser } from "./types";

const ROLE_HINT: Record<RoleKey, string> = {
  student: "Acessa cursos, atividades e comunidade",
  teacher: "Cria cursos, corrige atividades e vê seus alunos",
  manager: "Vê indicadores, relatórios e todos os alunos",
  admin: "Acesso total à administração",
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user?: EditableUser;
  canGrantAdmin: boolean;
  isSelf?: boolean;
};

/** O formulário só monta com o diálogo aberto — o estado sempre nasce dos dados atuais. */
export function UserFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <UserFormContent {...props} />}
    </Dialog>
  );
}

function UserFormContent({ onOpenChange, user, canGrantAdmin, isSelf }: Props) {
  const router = useRouter();
  const editing = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [headline, setHeadline] = useState(user?.headline ?? "");
  const [roles, setRoles] = useState<RoleKey[]>(user?.roles ?? ["student"]);
  const [status, setStatus] = useState<EditableUser["status"]>(
    user?.status ?? "ACTIVE",
  );
  const [sendInvite, setSendInvite] = useState(true);

  const create = useAction(createUserAction, {
    onSuccess: (d) => {
      toast.success(
        d.invited
          ? "Conta criada. Enviamos o link para definir a senha."
          : "Conta criada. Envie o link de senha quando quiser.",
      );
      onOpenChange(false);
      router.refresh();
    },
  });
  const update = useAction(updateUserAction, {
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  const a = editing ? update : create;
  const fe = a.fieldErrors;

  function toggle(r: RoleKey, on: boolean) {
    setRoles((cur) =>
      on ? [...new Set([...cur, r])] : cur.filter((x) => x !== r),
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const base = { name, email, phone, headline, roles };
    if (editing) update.run({ ...base, id: user!.id, status });
    else create.run({ ...base, sendInvite });
  }

  return (
    <DialogContent
      title={editing ? "Editar usuário" : "Novo usuário"}
      description={
        editing
          ? user!.email
          : "A pessoa recebe um e-mail para definir a própria senha."
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={a.pending}>
            {editing ? "Salvar alterações" : "Criar conta"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        {a.error && !Object.keys(fe).length && (
          <Alert tone="danger">{a.error}</Alert>
        )}
        <Field label="Nome completo" required error={fe.name}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="E-mail" required error={fe.email}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone" error={fe.phone}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </Field>
          <Field label="Cargo / função" error={fe.headline}>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </Field>
        </div>
        <fieldset>
          <legend className="text-small font-medium text-fg">Perfis</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ROLE_KEYS.map((r) => {
              const locked =
                r === "admin" &&
                (!canGrantAdmin || (isSelf && roles.includes("admin")));
              return (
                <label
                  key={r}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 has-[button[data-state=checked]]:border-primary/40 has-[button[data-state=checked]]:bg-primary-soft/40"
                >
                  <Checkbox
                    checked={roles.includes(r)}
                    onCheckedChange={(v) => toggle(r, v === true)}
                    disabled={locked}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {ROLE_LABELS[r]}
                    </span>
                    <span className="block text-caption text-muted">
                      {ROLE_HINT[r]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {fe.roles && (
            <p
              role="alert"
              className="mt-1.5 text-caption font-medium text-danger"
            >
              {fe.roles}
            </p>
          )}
        </fieldset>
        {editing ? (
          <Field
            label="Status"
            hint={
              isSelf
                ? "Você não pode alterar o status da própria conta."
                : "Inativar ou bloquear encerra as sessões abertas."
            }
          >
            <NativeSelect
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as EditableUser["status"])
              }
              disabled={isSelf}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
              <option value="BLOCKED">Bloqueado</option>
            </NativeSelect>
          </Field>
        ) : (
          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={sendInvite}
              onCheckedChange={(v) => setSendInvite(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Enviar e-mail para definir a senha
              <span className="block text-caption text-muted">
                O link vale por 72 horas. Sem ele, a conta fica sem senha até
                você enviar um link.
              </span>
            </span>
          </label>
        )}
      </form>
    </DialogContent>
  );
}
