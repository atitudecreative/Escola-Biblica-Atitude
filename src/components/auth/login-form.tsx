"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { useAction } from "@/hooks/use-action";
import { loginAction } from "@/app/(auth)/actions";
import { loginSchema } from "@/lib/validation/auth";

export function LoginForm({ next, notice }: { next?: string; notice?: React.ReactNode }) {
  const [remember, setRemember] = useState(true);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const { run, pending, error, fieldErrors } = useAction(loginAction);
  const errors = { ...fieldErrors, ...clientErrors };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = { email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? ""), remember, next };
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setClientErrors(errs);
      return;
    }
    setClientErrors({});
    run(input);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {notice}
      {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
      <Field label="E-mail" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" autoFocus />
      </Field>
      <Field
        label="Senha"
        error={errors.password}
        labelAction={
          <Link href="/forgot-password" className="text-small font-medium text-primary hover:underline">
            Esqueceu a senha?
          </Link>
        }
      >
        <PasswordInput name="password" autoComplete="current-password" placeholder="Sua senha" />
      </Field>
      <label className="flex items-center gap-2.5 text-sm text-muted select-none">
        <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} aria-label="Lembrar acesso" />
        Manter conectado por 30 dias
      </label>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Entrar
      </Button>
    </form>
  );
}
