import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { CertificateLookup } from "@/components/certificate/lookup-form";

export const metadata: Metadata = {
  title: "Validar certificado",
  description: "Confirme a autenticidade de um certificado emitido pela Escola Bíblica Atitude.",
};

export default function CertificateLookupPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:py-28">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary"><ShieldCheck className="size-6" /></span>
      <h1 className="mt-6 font-display text-[2.25rem] leading-tight tracking-tight">Validar certificado</h1>
      <p className="mt-3 text-muted">Digite o código impresso no certificado ou aponte a câmera para o QR Code.</p>
      <div className="mt-8 text-left">
        <CertificateLookup />
      </div>
    </div>
  );
}
