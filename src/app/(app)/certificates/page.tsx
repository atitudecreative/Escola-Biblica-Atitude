import type { Metadata } from "next";
import Link from "next/link";
import { Award, Download, ExternalLink } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyLinkButton } from "@/components/certificate/copy-link";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Certificados" };

export default async function CertificatesPage() {
  const user = await requireUserPage();
  const certs = await db.certificate.findMany({ where: { userId: user.id }, orderBy: { issuedAt: "desc" }, include: { course: { select: { slug: true } } } });
  const inProgress = await db.enrollment.count({ where: { userId: user.id, status: "ACTIVE" } });

  return (
    <>
      <PageHeader title="Certificados" description="Certificados emitidos ao concluir cursos. Qualquer pessoa pode validá-los pelo código." />
      {certs.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Seu primeiro certificado está a caminho"
          description={inProgress ? `Você tem ${inProgress} curso(s) em andamento. Conclua todas as aulas para receber o certificado.` : "Conclua um curso para receber seu certificado."}
          action={<Button asChild><Link href={inProgress ? "/my-courses" : "/courses"}>{inProgress ? "Continuar estudando" : "Explorar cursos"}</Link></Button>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {certs.map((c) => (
            <li key={c.id} className="relative overflow-hidden rounded-xl border border-border bg-surface">
              <div className="h-1 bg-accent" aria-hidden />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-fg"><Award className="size-5" /></span>
                  {c.revokedAt ? <Badge tone="danger">Revogado</Badge> : <Badge tone="success" dot>Válido</Badge>}
                </div>
                <h2 className="mt-4 font-display text-[1.375rem] leading-snug">{c.courseTitle}</h2>
                <p className="mt-1 text-small text-muted">{c.workloadHours} horas · emitido em {formatDate(c.issuedAt)} · {c.instructorName}</p>
                <p className="mt-3 font-mono text-caption tracking-wider text-subtle">{c.code}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild size="sm"><a href={`/api/certificates/${c.code}/pdf`}><Download /> Baixar PDF</a></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/certificate/${c.code}`} target="_blank"><ExternalLink /> Página de validação</Link></Button>
                  <CopyLinkButton path={`/certificate/${c.code}`} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
