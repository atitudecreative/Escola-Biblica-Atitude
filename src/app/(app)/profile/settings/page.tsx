import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, ShieldCheck } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { getProfile, listSessions, readPrivacy } from "@/server/services/profile";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AppearanceForm, PasswordForm, PrivacyForm, SessionsList } from "@/components/profile/settings-forms";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Preferências e segurança" };

export default async function SettingsPage() {
  const user = await requireUserPage();
  const [profile, sessions, security] = await Promise.all([getProfile(user.id), listSessions(user.id), getSettings("security")]);

  const sections = [
    { id: "aparencia", label: "Aparência e idioma" },
    { id: "notificacoes", label: "Notificações" },
    { id: "senha", label: "Senha" },
    { id: "sessoes", label: "Sessões" },
    { id: "privacidade", label: "Privacidade" },
  ];

  return (
    <>
      <PageHeader title="Preferências e segurança" breadcrumbs={[{ label: "Meu perfil", href: "/profile" }, { label: "Preferências" }]} />
      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Seções" className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5">
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="block rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">{s.label}</a></li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <Card id="aparencia" className="scroll-mt-24">
            <CardHeader title="Aparência e idioma" description="O tema é salvo neste navegador." />
            <CardBody><AppearanceForm /></CardBody>
          </Card>
          <Card id="notificacoes" className="scroll-mt-24">
            <CardHeader title="Notificações" description="Escolha o que você recebe na plataforma e por e-mail." />
            <CardBody>
              <Link href="/notifications?tab=preferences" className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm transition hover:bg-surface-2">
                <Bell className="size-4 text-subtle" /> <span className="flex-1">Gerenciar preferências de notificação</span> <ArrowRight className="size-4 text-subtle" />
              </Link>
            </CardBody>
          </Card>
          <Card id="senha" className="scroll-mt-24">
            <CardHeader title="Senha" description={`Mínimo de ${security.minPasswordLength} caracteres. Ao alterar, as outras sessões são encerradas.`} />
            <CardBody><PasswordForm /></CardBody>
          </Card>
          <Card id="sessoes" className="scroll-mt-24">
            <CardHeader title="Sessões ativas" description="Dispositivos conectados à sua conta." />
            <CardBody>
              <SessionsList sessions={sessions} currentId={user.sessionId} />
              <Alert tone="info" className="mt-4">
                <ShieldCheck className="mr-1 inline size-4" /> Verificação em duas etapas (2FA) está preparada na plataforma e será liberada em breve.
              </Alert>
            </CardBody>
          </Card>
          <Card id="privacidade" className="scroll-mt-24">
            <CardHeader title="Privacidade" />
            <CardBody><PrivacyForm initial={readPrivacy(profile.preferences)} /></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
