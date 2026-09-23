"use client";
import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useAction } from "@/hooks/use-action";
import { forgotPasswordAction } from "@/app/(auth)/actions";

export function ForgotForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { run, pending, error, fieldErrors } = useAction(forgotPasswordAction);

  if (sentTo)
    return (
      <div className="animate-slide-up text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheck className="size-6" />
        </div>
        <h1 className="mt-5 text-h2">Verifique seu e-mail</h1>
        <p className="mt-2 text-sm text-muted">
          Se existir uma conta para <strong className="text-fg">{sentTo}</strong>, você receberá um link para criar uma nova
          senha. O link vale por 1 hora.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/login">Voltar para o login</Link>
        </Button>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        const res = await run({ email });
        if (res?.ok) setSentTo(email);
      }}
      className="flex flex-col gap-4 animate-slide-up"
    >
      <div className="mb-4">
        <h1 className="text-h1">Recuperar senha</h1>
        <p className="mt-1.5 text-sm text-muted">Informe o e-mail da sua conta e enviaremos um link de redefinição.</p>
      </div>
      {error && !fieldErrors.email && <Alert tone="danger">{error}</Alert>}
      <Field label="E-mail" error={fieldErrors.email}>
        <Input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" autoFocus />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Enviar link
      </Button>
      <Link href="/login" className="text-center text-sm font-medium text-muted hover:text-fg">
        Voltar para o login
      </Link>
    </form>
  );
}
