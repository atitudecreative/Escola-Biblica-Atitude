import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck, MailX } from "lucide-react";
import { verifyEmail } from "@/server/services/auth";
import { getSessionUser } from "@/server/auth/session";
import { Button } from "@/components/ui/button";
import { ResendVerificationButton } from "@/components/auth/resend-verification";

export const metadata: Metadata = { title: "Confirmar e-mail", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token, sent } = await searchParams;
  const user = await getSessionUser();

  if (typeof token === "string") {
    const ok = await verifyEmail(token);
    if (ok) redirect(user ? "/dashboard?verified=1" : "/login?verified=1");
    return (
      <Status
        icon={<MailX className="size-6" />}
        tone="danger"
        title="Link inválido ou expirado"
        text="Este link de confirmação não é mais válido. Solicite um novo abaixo."
        action={user ? <ResendVerificationButton /> : <Button asChild variant="outline"><Link href="/login">Entrar</Link></Button>}
      />
    );
  }

  return (
    <Status
      icon={<MailCheck className="size-6" />}
      tone="success"
      title={sent ? "Confira sua caixa de entrada" : "Confirme seu e-mail"}
      text="Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta."
      action={user ? <ResendVerificationButton /> : <Button asChild variant="outline"><Link href="/login">Voltar ao login</Link></Button>}
    />
  );
}

function Status({ icon, tone, title, text, action }: { icon: React.ReactNode; tone: "success" | "danger"; title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="animate-slide-up text-center">
      <div className={`mx-auto flex size-12 items-center justify-center rounded-full ${tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
        {icon}
      </div>
      <h1 className="mt-5 text-h2">{title}</h1>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <div className="mt-8 flex justify-center">{action}</div>
    </div>
  );
}
