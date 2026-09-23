"use client";
import { RelativeTime } from "@/components/ui/relative-time";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Laptop, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { useAction } from "@/hooks/use-action";
import { changePasswordAction, revokeOtherSessionsAction, revokeSessionAction, savePrivacyAction } from "@/app/(app)/profile/actions";
import type { Privacy } from "@/lib/validation/profile";

import { cn } from "@/lib/utils";

export function PasswordForm() {
  const [key, setKey] = useState(0);
  const { run, pending, fieldErrors } = useAction(changePasswordAction, { onSuccess: () => setKey((k) => k + 1) });
  return (
    <form
      key={key}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run({ current: String(fd.get("current")), password: String(fd.get("password")), confirm: String(fd.get("confirm")) });
      }}
      className="grid max-w-md gap-4"
    >
      <Field label="Senha atual" error={fieldErrors.current}>
        <PasswordInput name="current" autoComplete="current-password" />
      </Field>
      <Field label="Nova senha" error={fieldErrors.password} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput name="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirmar nova senha" error={fieldErrors.confirm}>
        <PasswordInput name="confirm" autoComplete="new-password" />
      </Field>
      <div>
        <Button type="submit" loading={pending}>Alterar senha</Button>
      </div>
    </form>
  );
}

export function AppearanceForm() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- evita divergência de hidratação
  useEffect(() => setMounted(true), []);
  const options = [
    { v: "light", label: "Claro", icon: Sun },
    { v: "dark", label: "Escuro", icon: Moon },
    { v: "system", label: "Sistema", icon: Monitor },
  ];
  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Tema" className="grid max-w-md grid-cols-3 gap-2">
        {options.map((o) => {
          const active = mounted && theme === o.v;
          return (
            <button
              key={o.v}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(o.v)}
              className={cn("flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-small font-medium transition", active ? "border-primary bg-primary-soft/60 text-fg" : "border-border text-muted hover:border-border-strong")}
            >
              <o.icon className="size-5" /> {o.label}
            </button>
          );
        })}
      </div>
      <Field label="Idioma" hint="Outros idiomas estão preparados na arquitetura e serão liberados no futuro.">
        <NativeSelect defaultValue="pt-BR" className="max-w-xs" disabled>
          <option value="pt-BR">Português (Brasil)</option>
        </NativeSelect>
      </Field>
    </div>
  );
}

export function PrivacyForm({ initial }: { initial: Privacy }) {
  const [p, setP] = useState(initial);
  const { run, pending } = useAction(savePrivacyAction);
  const rows: { key: keyof Privacy; title: string; text: string }[] = [
    { key: "showInRanking", title: "Aparecer no ranking", text: "Seu nome e XP podem aparecer nas classificações da comunidade." },
    { key: "showProgressToTeachers", title: "Compartilhar progresso com professores", text: "Professores veem seu progresso para acompanhar e ajudar você." },
    { key: "publicProfile", title: "Perfil público", text: "Outras pessoas da comunidade podem ver sua bio e conquistas." },
  ];
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <label key={r.key} className="flex items-start justify-between gap-6 border-b border-border py-4 last:border-0">
          <span>
            <span className="block text-sm font-medium">{r.title}</span>
            <span className="block text-small text-muted">{r.text}</span>
          </span>
          <Switch checked={p[r.key]} onCheckedChange={(v) => setP((x) => ({ ...x, [r.key]: v }))} aria-label={r.title} />
        </label>
      ))}
      <div className="pt-3">
        <Button onClick={() => run(p)} loading={pending} disabled={JSON.stringify(p) === JSON.stringify(initial)}>Salvar privacidade</Button>
      </div>
    </div>
  );
}

type SessionRow = { id: string; userAgent: string | null; ip: string | null; createdAt: Date; lastUsedAt: Date };

function describeAgent(ua: string | null) {
  if (!ua) return { label: "Dispositivo desconhecido", mobile: false };
  const mobile = /Mobile|Android|iPhone/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) && !mobile ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: `${browser}${os ? ` · ${os}` : ""}`, mobile };
}

export function SessionsList({ sessions, currentId }: { sessions: SessionRow[]; currentId: string }) {
  const confirm = useConfirm();
  const one = useAction(revokeSessionAction, { errorToast: true });
  const all = useAction(revokeOtherSessionsAction, { errorToast: true });
  return (
    <div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {sessions.map((s) => {
          const d = describeAgent(s.userAgent);
          const Icon = d.mobile ? Smartphone : Laptop;
          const current = s.id === currentId;
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-5 shrink-0 text-subtle" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">{d.label} {current && <Badge tone="success">Esta sessão</Badge>}</p>
                <p className="text-caption text-subtle">{s.ip ?? "IP desconhecido"} · ativo <RelativeTime date={s.lastUsedAt} /></p>
              </div>
              {!current && (
                <Button variant="ghost" size="sm" onClick={async () => (await confirm({ title: "Encerrar sessão?", description: "O dispositivo precisará entrar novamente.", confirmLabel: "Encerrar" })) && one.run(s.id)}>
                  Encerrar
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {sessions.length > 1 && (
        <Button className="mt-3" variant="outline" loading={all.pending} onClick={async () => (await confirm({ title: "Sair de todos os outros dispositivos?", confirmLabel: "Encerrar sessões" })) && all.run(undefined as never)}>
          Encerrar todas as outras sessões
        </Button>
      )}
    </div>
  );
}
