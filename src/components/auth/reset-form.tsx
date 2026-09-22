"use client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert } from "@/components/ui/alert";
import { useAction } from "@/hooks/use-action";
import { resetPasswordAction } from "@/app/(auth)/actions";

export function ResetForm({ token }: { token: string }) {
  const { run, pending, error, fieldErrors } = useAction(resetPasswordAction);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run({ token, password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") });
      }}
      className="flex flex-col gap-4"
    >
      {error && !Object.keys(fieldErrors).length && <Alert tone="danger">{error}</Alert>}
      <Field label="Nova senha" error={fieldErrors.password} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput name="password" autoComplete="new-password" autoFocus />
      </Field>
      <Field label="Confirme a nova senha" error={fieldErrors.confirm}>
        <PasswordInput name="confirm" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Salvar nova senha
      </Button>
    </form>
  );
}
