import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/reset-form";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  return (
    <div className="animate-slide-up">
      <h1 className="text-h1">Crie uma nova senha</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted">Por segurança, você sairá de todos os dispositivos conectados.</p>
      {typeof token === "string" && token.length > 20 ? (
        <ResetForm token={token} />
      ) : (
        <Alert tone="danger" title="Link inválido">
          Este link de redefinição está incompleto.{" "}
          <Link href="/forgot-password" className="font-medium underline">
            Solicite um novo
          </Link>
          .
        </Alert>
      )}
    </div>
  );
}
