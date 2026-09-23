"use client";
import { useState } from "react";
import { Award, Download, ExternalLink, MoreHorizontal, RotateCcw, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { useAction } from "@/hooks/use-action";
import { issueCertificateAction, restoreCertificateAction, revokeCertificateAction } from "@/app/(app)/admin/certificates/actions";

export function CertificateRowMenu({ cert }: { cert: { id: string; code: string; studentName: string; revoked: boolean } }) {
  const [revoking, setRevoking] = useState(false);
  const confirm = useConfirm();
  const restore = useAction(restoreCertificateAction, { errorToast: true });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${cert.code}`}><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <a href={`/api/certificates/${cert.code}/pdf`} target="_blank" rel="noopener"><Download /> Baixar PDF</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/certificate/${cert.code}`} target="_blank" rel="noopener"><ExternalLink /> Página de validação</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {cert.revoked ? (
            <DropdownMenuItem
              onSelect={async () => {
                if (await confirm({ title: "Restaurar certificado?", description: `O certificado ${cert.code} volta a ser válido e o aluno é notificado.`, confirmLabel: "Restaurar", tone: "primary" }))
                  restore.run(cert.id);
              }}
            >
              <RotateCcw /> Restaurar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem tone="danger" onSelect={() => setRevoking(true)}><ShieldX /> Revogar</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {revoking && <RevokeDialog cert={cert} onClose={() => setRevoking(false)} />}
    </>
  );
}

function RevokeDialog({ cert, onClose }: { cert: { id: string; code: string; studentName: string }; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const act = useAction(revokeCertificateAction, { onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Revogar certificado"
        description={`${cert.code} · ${cert.studentName}. A página de validação passará a mostrar o certificado como revogado, com o motivo.`}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button variant="danger" loading={act.pending} onClick={() => act.run({ id: cert.id, reason })}>Revogar certificado</Button>
          </>
        }
      >
        <Field label="Motivo" required error={act.fieldErrors.reason ?? (act.error && !act.fieldErrors.reason ? act.error : null)} hint="O aluno recebe este motivo na notificação.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="Ex.: Emitido por engano para a matrícula errada." autoFocus />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

export function IssueButton({ enrollmentId, disabled }: { enrollmentId: string; disabled?: boolean }) {
  const act = useAction(issueCertificateAction, { errorToast: true, onSuccess: (code) => toast.success(`Certificado ${code} emitido. O aluno foi avisado.`) });
  return (
    <Button size="sm" variant="outline" loading={act.pending} disabled={disabled} onClick={() => act.run(enrollmentId)}>
      <Award /> Emitir
    </Button>
  );
}
