import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { DemoAccounts } from "@/components/auth/demo-accounts";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const notice = sp.reset ? (
    <Alert tone="success">Senha redefinida. Entre com a nova senha.</Alert>
  ) : sp.verified ? (
    <Alert tone="success">E-mail confirmado! Agora é só entrar.</Alert>
  ) : null;

  return (
    <div className="animate-slide-up">
      <h1 className="text-h1">Bem-vindo de volta</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted">Entre para continuar seus estudos.</p>
      <LoginForm next={next} notice={notice} />
      <p className="mt-8 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Criar conta gratuita
        </Link>
      </p>
      {process.env.DEMO_MODE === "true" && <DemoAccounts />}
    </div>
  );
}
