"use client";
import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";
import { formatDateTime } from "@/lib/format";
import { getEmailAction } from "@/app/(app)/admin/logs/actions";

type Email = { id: string; to: string; subject: string; text: string; template: string; status: string; provider: string; error: string | null; createdAt: string };

/** Transforma URLs do texto em links clicáveis (útil em modo demo: links de confirmação e redefinição). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function EmailViewer({ id, subject }: { id: string; subject: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<Email | null>(null);
  const act = useAction(getEmailAction, { errorToast: true, onSuccess: setEmail });
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true);
          if (!email) act.run(id);
        }}
        aria-label={`Ver e-mail: ${subject}`}
      >
        <Eye /> <span className="hidden lg:inline">Ver</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" title={email?.subject ?? subject} description={email ? `Para ${email.to} · ${formatDateTime(email.createdAt)}` : "Carregando…"}>
          {!email ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge tone="neutral">Modelo: {email.template}</Badge>
                <Badge tone="neutral">Provedor: {email.provider}</Badge>
              </div>
              {email.error && <p className="mb-3 rounded-md bg-danger-soft px-3 py-2 text-small text-danger">Erro: {email.error}</p>}
              <pre className="max-h-[55dvh] overflow-auto rounded-lg border border-border bg-surface-2 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                <Linkified text={email.text} />
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
