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
import { registerAction } from "@/app/(auth)/actions";
import { passwordStrength, registerSchema } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

const strengthLabel = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];

export function RegisterForm() {
  const [pw, setPw] = useState("");
  const [accept, setAccept] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const { run, pending, error, fieldErrors } = useAction(registerAction);
  const errors = { ...fieldErrors, ...clientErrors };
  const strength = passwordStrength(pw);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), password: pw, acceptTerms: accept };
    const parsed = registerSchema.safeParse(input);
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
      {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
      <Field label="Nome completo" error={errors.name}>
        <Input name="name" autoComplete="name" placeholder="Como aparecerá no certificado" autoFocus />
      </Field>
      <Field label="E-mail" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" />
      </Field>
      <Field label="Senha" error={errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput name="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      {pw && (
        <div className="-mt-2 flex items-center gap-3" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < strength ? (strength <= 1 ? "bg-danger" : strength === 2 ? "bg-warning" : "bg-success") : "bg-surface-3",
                )}
              />
            ))}
          </div>
          <span className="w-20 text-right text-caption text-muted">{strengthLabel[strength]}</span>
        </div>
      )}
      <div>
        <label className="flex items-start gap-2.5 text-sm text-muted select-none">
          <Checkbox className="mt-0.5" checked={accept} onCheckedChange={(v) => setAccept(v === true)} aria-label="Aceito os termos" />
          <span>
            Li e aceito os termos de uso e a política de privacidade da Escola.
          </span>
        </label>
        {errors.acceptTerms && <p role="alert" className="mt-1 text-caption font-medium text-danger">{errors.acceptTerms}</p>}
      </div>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Criar conta
      </Button>
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
