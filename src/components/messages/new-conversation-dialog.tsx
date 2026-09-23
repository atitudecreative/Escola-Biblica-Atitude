"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LifeBuoy, Search, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import type { ContactDTO } from "@/server/services/messages";
import { contactsAction, openDirectAction, openSupportAction } from "@/app/(app)/messages/actions";
import { useMessages } from "./messages-provider";

export function NewConversationDialog({
  children,
  supportEnabled,
  canStartSupport,
}: {
  children: React.ReactNode;
  supportEnabled: boolean;
  canStartSupport: boolean;
}) {
  const [open, setOpen] = useState(false);
  const showSupport = supportEnabled && canStartSupport;
  const [tab, setTab] = useState<"person" | "support">("person");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title="Nova conversa" description="Escolha com quem você quer falar." size="md">
        {showSupport && (
          <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-0.5">
            {(
              [
                ["person", "Pessoa", UserRound],
                ["support", "Suporte da Escola", LifeBuoy],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-2 rounded-md text-small font-medium transition-all",
                  tab === k ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        )}
        {tab === "person" || !showSupport ? <PersonPicker onDone={() => setOpen(false)} /> : <SupportForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PersonPicker({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { reload } = useMessages();
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<ContactDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(
      () =>
        startLoading(async () => {
          const res = await contactsAction(q);
          if (res.ok) {
            setContacts(res.data);
            setError(null);
          } else setError(res.error);
        }),
      q ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [q]);

  async function open(c: ContactDTO) {
    setOpening(c.id);
    const res = await openDirectAction(c.id);
    setOpening(null);
    if (!res.ok) return toast.error(res.error);
    await reload();
    onDone();
    router.push(`/messages/${res.data}`);
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar pessoas" className="pl-9" />
        {loading && contacts && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle" />}
      </div>
      <div className="mt-3 max-h-[min(50dvh,360px)] min-h-40 overflow-y-auto">
        {error ? (
          <p className="py-8 text-center text-small text-danger">{error}</p>
        ) : !contacts ? (
          <div className="space-y-3 py-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-fg">{q ? "Ninguém encontrado" : "Nenhum contato disponível"}</p>
            <p className="mx-auto mt-1 max-w-xs text-small text-muted">
              {q
                ? "Confira a grafia do nome."
                : "Você pode conversar com os professores dos cursos em que está matriculado. Para outras dúvidas, fale com o suporte."}
            </p>
          </div>
        ) : (
          <ul className="-mx-2">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => open(c)}
                  disabled={!!opening}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
                >
                  <Avatar name={c.name} src={c.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                    <span className="block truncate text-caption text-muted">{c.context}</span>
                  </span>
                  {opening === c.id ? <Spinner className="text-subtle" /> : <ChevronRight className="size-4 text-subtle" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SupportForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { reload } = useMessages();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const { run, pending, fieldErrors, error } = useAction(openSupportAction);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ subject, body });
    if (res?.ok) {
      await reload();
      onDone();
      router.push(`/messages/${res.data}`);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-small text-muted">A equipe da Escola responde em horário comercial. Você receberá uma notificação quando houver resposta.</p>
      <Field label="Assunto" error={fieldErrors.subject} required>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: Não consigo baixar o material" maxLength={120} />
      </Field>
      <Field label="Como podemos ajudar?" error={fieldErrors.body} required>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} placeholder="Descreva o que aconteceu, em qual curso ou aula, e o que você já tentou." />
      </Field>
      {error && !Object.keys(fieldErrors).length && <p role="alert" className="text-small font-medium text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Enviar para o suporte
        </Button>
      </div>
    </form>
  );
}
