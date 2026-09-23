"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Download, Eye, KeyRound, MessageSquare, MoreHorizontal, Pencil, Plus, ShieldCheck, UserCheck, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm";
import { BulkBar } from "@/components/data/bulk-select";
import { useAction } from "@/hooks/use-action";
import { sendResetLinkAction, setUsersStatusAction } from "@/app/(app)/admin/users/actions";
import { UserFormDialog } from "./user-form-dialog";
import type { EditableUser } from "./types";

type Status = EditableUser["status"];

const STATUS_COPY: Record<Status, { title: (n: string) => string; description: string; confirm: string; done: string; tone: "danger" | "primary" }> = {
  BLOCKED: {
    title: (n) => `Bloquear ${n}?`,
    description: "A pessoa é desconectada de todos os dispositivos e não consegue mais entrar até ser desbloqueada.",
    confirm: "Bloquear",
    done: "bloqueada(s)",
    tone: "danger",
  },
  INACTIVE: {
    title: (n) => `Inativar ${n}?`,
    description: "A conta fica suspensa e as sessões abertas são encerradas. O histórico é mantido.",
    confirm: "Inativar",
    done: "inativada(s)",
    tone: "danger",
  },
  ACTIVE: {
    title: (n) => `Reativar ${n}?`,
    description: "A pessoa volta a conseguir entrar com a senha atual.",
    confirm: "Reativar",
    done: "reativada(s)",
    tone: "primary",
  },
};

/** Muda status com confirmação + toast. Reutilizado no menu da linha, em massa e no perfil. */
function useStatusChange() {
  const confirm = useConfirm();
  const router = useRouter();
  const { run, pending } = useAction(setUsersStatusAction, { errorToast: true });
  async function change(ids: string[], status: Status, label: string) {
    const c = STATUS_COPY[status];
    const ok = await confirm({ title: c.title(label), description: c.description, confirmLabel: c.confirm, tone: c.tone });
    if (!ok) return false;
    const res = await run({ ids, status });
    if (res?.ok) {
      const n = (res.data as { changed: number }).changed;
      toast.success(n ? `${n} conta(s) ${c.done}.` : "Nenhuma alteração: as contas já estavam nesse status (a sua é ignorada).");
      router.refresh();
      return true;
    }
    return false;
  }
  return { change, pending };
}

function useResetLink() {
  const confirm = useConfirm();
  const { run, pending } = useAction(sendResetLinkAction, { errorToast: true });
  async function send(u: { id: string; name: string; email: string }) {
    const ok = await confirm({
      title: "Enviar link de redefinição de senha?",
      description: `${u.name} receberá em ${u.email} um link válido por 1 hora. A senha atual continua funcionando até ser trocada.`,
      confirmLabel: "Enviar link",
      tone: "primary",
    });
    if (!ok) return;
    const res = await run(u.id);
    if (res?.ok) toast.success(`Link enviado para ${u.email}.`);
  }
  return { send, pending };
}

export function UserRowMenu({
  user,
  canManage,
  canGrantAdmin,
  isSelf,
  profileHref,
  messageHref,
}: {
  user: EditableUser;
  canManage: boolean;
  canGrantAdmin: boolean;
  isSelf: boolean;
  profileHref?: string;
  messageHref?: string;
}) {
  const [edit, setEdit] = useState(false);
  const { change } = useStatusChange();
  const { send } = useResetLink();
  const first = user.name.split(" ")[0];
  if (!canManage && !profileHref) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${user.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {profileHref && (
            <DropdownMenuItem asChild>
              <Link href={profileHref}>
                <Eye /> Ver perfil
              </Link>
            </DropdownMenuItem>
          )}
          {messageHref && (
            <DropdownMenuItem asChild>
              <Link href={messageHref}>
                <MessageSquare /> Enviar mensagem
              </Link>
            </DropdownMenuItem>
          )}
          {canManage && (
            <>
              <DropdownMenuItem onSelect={() => setEdit(true)}>
                <Pencil /> Editar dados e perfis
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => send(user)} disabled={user.status === "BLOCKED"}>
                <KeyRound /> Enviar link de senha
              </DropdownMenuItem>
              {!isSelf && (
                <>
                  <DropdownMenuSeparator />
                  {user.status !== "ACTIVE" && (
                    <DropdownMenuItem onSelect={() => change([user.id], "ACTIVE", first)}>
                      {user.status === "BLOCKED" ? <ShieldCheck /> : <UserCheck />} {user.status === "BLOCKED" ? "Desbloquear" : "Reativar"}
                    </DropdownMenuItem>
                  )}
                  {user.status === "ACTIVE" && (
                    <DropdownMenuItem onSelect={() => change([user.id], "INACTIVE", first)}>
                      <UserMinus /> Inativar
                    </DropdownMenuItem>
                  )}
                  {user.status !== "BLOCKED" && (
                    <DropdownMenuItem tone="danger" onSelect={() => change([user.id], "BLOCKED", first)}>
                      <Ban /> Bloquear
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canManage && <UserFormDialog open={edit} onOpenChange={setEdit} user={user} canGrantAdmin={canGrantAdmin} isSelf={isSelf} />}
    </>
  );
}

/** Ações do cabeçalho de um perfil (aluno/professor). */
export function ProfileActions({ user, canManage, canGrantAdmin, isSelf }: { user: EditableUser; canManage: boolean; canGrantAdmin: boolean; isSelf: boolean }) {
  const [edit, setEdit] = useState(false);
  const { change, pending } = useStatusChange();
  const { send, pending: sending } = useResetLink();
  if (!canManage) return null;
  const first = user.name.split(" ")[0];
  return (
    <>
      <Button variant="outline" onClick={() => setEdit(true)}>
        <Pencil /> Editar
      </Button>
      <Button variant="outline" onClick={() => send(user)} loading={sending} disabled={user.status === "BLOCKED"}>
        <KeyRound /> Resetar senha
      </Button>
      {!isSelf &&
        (user.status === "BLOCKED" ? (
          <Button variant="outline" onClick={() => change([user.id], "ACTIVE", first)} loading={pending}>
            <ShieldCheck /> Desbloquear
          </Button>
        ) : (
          <Button variant="danger-ghost" onClick={() => change([user.id], "BLOCKED", first)} loading={pending}>
            <Ban /> Bloquear
          </Button>
        ))}
      <UserFormDialog open={edit} onOpenChange={setEdit} user={user} canGrantAdmin={canGrantAdmin} isSelf={isSelf} />
    </>
  );
}

export function UsersBulkBar({ canManage, canExport }: { canManage: boolean; canExport: boolean }) {
  const { change, pending } = useStatusChange();
  return (
    <BulkBar>
      {(ids, clear) => (
        <>
          {canManage && (
            <>
              <Button size="sm" variant="ghost" disabled={pending} onClick={async () => (await change(ids, "ACTIVE", `${ids.length} conta(s)`)) && clear()}>
                <UserCheck /> Ativar
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={async () => (await change(ids, "INACTIVE", `${ids.length} conta(s)`)) && clear()}>
                <UserMinus /> Inativar
              </Button>
              <Button size="sm" variant="danger-ghost" disabled={pending} onClick={async () => (await change(ids, "BLOCKED", `${ids.length} conta(s)`)) && clear()}>
                <Ban /> Bloquear
              </Button>
            </>
          )}
          {canExport && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/reports/export?type=users&ids=${ids.join(",")}`} download>
                <Download /> Exportar
              </a>
            </Button>
          )}
        </>
      )}
    </BulkBar>
  );
}

export function CreateUserButton({ canGrantAdmin }: { canGrantAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Novo usuário
      </Button>
      <UserFormDialog open={open} onOpenChange={setOpen} canGrantAdmin={canGrantAdmin} />
    </>
  );
}
