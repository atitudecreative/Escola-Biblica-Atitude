import { MailWarning } from "lucide-react";
import { ResendVerificationButton } from "@/components/auth/resend-verification";

export function EmailVerificationBanner() {
  return (
    <div className="flex flex-col gap-2 border-b border-warning/20 bg-warning-soft px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:px-6 lg:px-10">
      <MailWarning className="hidden size-4 shrink-0 text-warning sm:block" />
      <p className="flex-1 text-fg/85">Confirme seu e-mail para receber certificados e notificações importantes.</p>
      <ResendVerificationButton size="sm" />
    </div>
  );
}
