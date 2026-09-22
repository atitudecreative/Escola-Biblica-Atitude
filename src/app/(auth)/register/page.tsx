import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { getSettings } from "@/server/settings";
import { EmptyState } from "@/components/ui/empty-state";
import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage() {
  const users = await getSettings("users");
  if (!users.allowRegistration) {
    return (
      <EmptyState
        icon={Lock}
        title="Inscrições fechadas no momento"
        description="O cadastro de novas contas está temporariamente fechado. Fale com a secretaria da Escola."
        action={<Button asChild variant="outline"><Link href="/login">Ir para o login</Link></Button>}
      />
    );
  }
  return (
    <div className="animate-slide-up">
      <h1 className="text-h1">Crie sua conta</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted">Gratuita. Leva menos de um minuto.</p>
      <RegisterForm />
    </div>
  );
}
