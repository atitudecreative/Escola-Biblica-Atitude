"use client";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { NotificationType } from "@prisma/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import { NOTIFICATION_TYPE } from "@/lib/labels";
import { saveNotificationPrefsAction } from "@/app/(app)/notifications/actions";
import { NOTIFICATION_ICON } from "./notification-center";

type Prefs = Record<string, { inApp: boolean; email: boolean }>;

const HINTS: Partial<Record<NotificationType, string>> = {
  MESSAGE: "Novas mensagens diretas e respostas do suporte",
  ANNOUNCEMENT: "Comunicados da Escola e dos seus cursos",
  COMMUNITY: "Respostas às suas discussões e soluções aceitas",
  NEW_LESSON: "Aulas publicadas nos cursos em que você está",
  COURSE: "Novidades e mudanças nos seus cursos",
  NEW_ASSIGNMENT: "Atividades novas para entregar",
  ASSIGNMENT_GRADED: "Correção das suas atividades",
  QUIZ_GRADED: "Correção de avaliações discursivas",
  CERTIFICATE: "Certificados emitidos",
  ACHIEVEMENT: "Conquistas desbloqueadas",
};

export function NotificationPreferences({
  initial,
  types,
  emailTypes,
  emailEnabled,
}: {
  initial: Prefs;
  types: NotificationType[];
  emailTypes: NotificationType[];
  emailEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(initial);
  const { run, pending } = useAction(saveNotificationPrefsAction, { errorToast: true });

  function set(t: string, k: "inApp" | "email", v: boolean) {
    setPrefs((p) => ({ ...p, [t]: { ...p[t], [k]: v } }));
  }

  async function save() {
    const res = await run(prefs);
    if (res?.ok) {
      setPrefs(res.data as Prefs);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o && setPrefs(initial))}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal /> Preferências
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Preferências de notificação"
        description="Escolha como quer ser avisado de cada tipo de atividade. Avisos do sistema e de segurança são sempre enviados."
        size="lg"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={save} loading={pending}>
              Salvar preferências
            </Button>
          </>
        }
      >
        {!emailEnabled && (
          <Alert tone="info" className="mb-4">
            O envio de e-mails está desativado pela administração da Escola. Suas escolhas de e-mail valerão quando ele for reativado.
          </Alert>
        )}
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-border bg-surface-2 px-4 py-2 text-caption font-medium text-muted sm:grid-cols-[minmax(0,1fr)_96px_96px]">
            <span>Tipo</span>
            <span className="text-center">Plataforma</span>
            <span className="text-center">E-mail</span>
          </div>
          <ul className="divide-y divide-border">
            {types.map((t) => {
              const { icon: Icon, tone } = NOTIFICATION_ICON[t];
              const hasEmail = emailTypes.includes(t);
              return (
                <li key={t} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_96px_96px]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`hidden size-8 shrink-0 items-center justify-center rounded-full sm:flex ${tone}`}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">{NOTIFICATION_TYPE[t]}</p>
                      {HINTS[t] && <p className="text-caption text-muted">{HINTS[t]}</p>}
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Switch checked={prefs[t]?.inApp ?? true} onCheckedChange={(v) => set(t, "inApp", v)} aria-label={`${NOTIFICATION_TYPE[t]} na plataforma`} />
                  </div>
                  <div className="flex justify-center">
                    {hasEmail ? (
                      <Switch checked={prefs[t]?.email ?? true} onCheckedChange={(v) => set(t, "email", v)} aria-label={`${NOTIFICATION_TYPE[t]} por e-mail`} />
                    ) : (
                      <span className="text-caption text-subtle" title="Este tipo ainda não é enviado por e-mail">
                        —
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-3 text-caption text-subtle">“—” indica tipos que hoje são avisados apenas na plataforma.</p>
      </DialogContent>
    </Dialog>
  );
}
