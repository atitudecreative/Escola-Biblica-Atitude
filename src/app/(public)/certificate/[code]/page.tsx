import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { BadgeCheck, Download, ShieldAlert, ShieldX } from "lucide-react";
import { getCertificateByCode, certificateUrl } from "@/server/services/certificates";
import { getSettings } from "@/server/settings";
import { CertificateLookup } from "@/components/certificate/lookup-form";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const LONG = "d 'de' MMMM 'de' yyyy";

export async function generateMetadata({ params }: PageProps<"/certificate/[code]">): Promise<Metadata> {
  const { code } = await params;
  const cert = /^[A-Z0-9-]{10,30}$/i.test(code) ? await getCertificateByCode(code) : null;
  return {
    title: cert ? `Certificado de ${cert.studentName}` : "Certificado não encontrado",
    robots: { index: false, follow: false },
  };
}

export default async function CertificatePage({ params }: PageProps<"/certificate/[code]">) {
  const { code } = await params;
  const valid = /^[A-Z0-9-]{10,30}$/i.test(code);
  const [cert, general] = await Promise.all([valid ? getCertificateByCode(code) : null, getSettings("general")]);

  if (!cert) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger"><ShieldX className="size-6" /></span>
        <h1 className="mt-6 text-h1">Certificado não encontrado</h1>
        <p className="mt-2 text-muted">Não existe certificado com o código <code className="font-mono text-fg">{code.toUpperCase()}</code>. Confira se foi digitado corretamente.</p>
        <div className="mt-8 text-left"><CertificateLookup initial={code.toUpperCase()} /></div>
      </div>
    );
  }

  const qr = await QRCode.toDataURL(certificateUrl(cert.code), { margin: 0, width: 240, color: { dark: "#1b1a17", light: "#ffffff" } });
  const revoked = !!cert.revokedAt;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <div className={`mb-8 flex items-start gap-3 rounded-xl border p-4 ${revoked ? "border-danger/25 bg-danger-soft" : "border-success/25 bg-success-soft"}`} role="status">
        {revoked ? <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" /> : <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" />}
        <div>
          <p className="font-semibold">{revoked ? "Este certificado foi revogado" : "Certificado autêntico"}</p>
          <p className="text-small text-muted">
            {revoked
              ? `Revogado em ${formatDate(cert.revokedAt)}${cert.revokedReason ? ` — ${cert.revokedReason}` : ""}.`
              : `Emitido por ${general.platformName} e registrado em nossa base em ${formatDate(cert.issuedAt)}.`}
          </p>
        </div>
      </div>

      {/* Representação visual do certificado */}
      <article className="relative overflow-hidden rounded-2xl border border-border bg-[#fbfaf6] text-[#1b1a17] shadow-md dark:bg-[#f4f2ea]">
        <div className="h-2" style={{ background: cert.template?.accentColor ?? "var(--brand)" }} />
        <div className="m-3 rounded-xl border px-6 py-10 text-center sm:m-5 sm:px-14 sm:py-14" style={{ borderColor: cert.template?.accentColor ?? "var(--brand)" }}>
          <p className="text-overline" style={{ color: cert.template?.accentColor ?? "var(--brand)" }}>{general.platformName}</p>
          <h1 className="mt-6 font-display text-[1.9rem] leading-tight sm:text-[2.6rem]">{cert.template?.heading ?? "Certificado de Conclusão"}</h1>
          <p className="mt-6 text-sm text-[#5d5b54]">Certificamos que</p>
          <p className="mt-2 font-display text-[1.75rem] italic sm:text-[2.25rem]">{cert.studentName}</p>
          <p className="mx-auto mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-[#3d3c37]">
            concluiu o curso <strong>{cert.courseTitle}</strong>, ministrado por {cert.instructorName}, com carga horária de {cert.workloadHours} horas, em {formatDate(cert.issuedAt, LONG)}.
          </p>
          <div className="mt-10 flex flex-col items-center justify-between gap-6 border-t border-[#e4e2da] pt-6 text-left sm:flex-row">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-small">
              <dt className="text-[#8b8980]">Código</dt>
              <dd className="font-mono font-medium">{cert.code}</dd>
              <dt className="text-[#8b8980]">Carga horária</dt>
              <dd>{cert.workloadHours} horas</dd>
              <dt className="text-[#8b8980]">Emissão</dt>
              <dd>{formatDate(cert.issuedAt, LONG)}</dd>
            </dl>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor (data URL) */}
            <img src={qr} alt={`QR Code de validação do certificado ${cert.code}`} className="size-24" />
          </div>
        </div>
      </article>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {!revoked && <Button asChild><a href={`/api/certificates/${cert.code}/pdf`}><Download /> Baixar PDF</a></Button>}
        <Button asChild variant="outline"><Link href={`/courses/${cert.course.slug}`}>Conhecer o curso</Link></Button>
      </div>
    </div>
  );
}
