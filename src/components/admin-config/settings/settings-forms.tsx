"use client";
import * as React from "react";
import { AlertTriangle, Check, CheckCircle2, ImageIcon, Lock, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { SegmentedList, SegmentedTrigger, Tabs } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { SaveBar } from "../save-bar";
import { useDirtyForm } from "../use-dirty-form";
import { contrast, isHex } from "./color";
import { saveSettingsAction } from "@/app/(app)/admin/settings/actions";

type Group = "general" | "appearance" | "users" | "courses" | "communication" | "security" | "integrations";

function useGroupForm<T extends Record<string, unknown>>(group: Group, initial: T) {
  const form = useDirtyForm(initial);
  const act = useAction(saveSettingsAction, { errorToast: true, onSuccess: () => form.commit() });
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    act.run({ group, values: form.values });
  };
  return { form, act, fe: act.fieldErrors, onSubmit };
}

export function SettingsSection({ title, description, children, className }: { title: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mb-8", className)}>
      <h2 className="text-h3">{title}</h2>
      {description && <p className="mt-0.5 text-small text-muted">{description}</p>}
      <div className="mt-4 rounded-xl border border-border bg-surface shadow-xs">{children}</div>
    </section>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  badge,
}: {
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 last:border-b-0 sm:px-5">
      <div className="min-w-0">
        <label htmlFor={id} className={cn("flex items-center gap-2 text-sm font-medium", disabled ? "text-muted" : "cursor-pointer")}>
          {label}
          {badge}
        </label>
        {description && <p className="mt-0.5 text-small text-muted">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-0.5" />
    </div>
  );
}

const pad = "grid gap-4 p-4 sm:p-5";

// ── Geral ───────────────────────────────────────────

export type GeneralValues = {
  platformName: string;
  shortName: string;
  tagline: string;
  description: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
};

export function GeneralForm({ initial }: { initial: GeneralValues }) {
  const { form, act, fe, onSubmit } = useGroupForm("general", initial);
  const v = form.values;
  return (
    <form onSubmit={onSubmit}>
      <SettingsSection title="Identidade" description="Nome e textos usados no site, nos e-mails e nos certificados.">
        <div className={pad}>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Nome da plataforma" required error={fe.platformName}>
              <Input value={v.platformName} maxLength={60} onChange={(e) => form.set("platformName", e.target.value)} />
            </Field>
            <Field label="Nome curto" required error={fe.shortName} hint="Ícone do app e espaços pequenos">
              <Input value={v.shortName} maxLength={20} onChange={(e) => form.set("shortName", e.target.value)} />
            </Field>
          </div>
          <Field label="Slogan" error={fe.tagline} hint="Aparece no título das páginas e no site.">
            <Input value={v.tagline} maxLength={120} onChange={(e) => form.set("tagline", e.target.value)} />
          </Field>
          <Field label="Descrição" error={fe.description} hint="Usada em buscadores e ao compartilhar links." labelAction={<span className="text-caption text-subtle">{v.description.length}/400</span>}>
            <Textarea value={v.description} maxLength={400} rows={3} onChange={(e) => form.set("description", e.target.value)} />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Logo" description="Exibido no topo do site e da área logada. Sem logo, usamos o símbolo padrão com o nome.">
        <div className={pad}>
          {v.logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-border bg-surface-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo enviado */}
                <img src={v.logoUrl} alt="Logo atual" className="max-h-full max-w-full object-contain" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => form.set("logoUrl", null)}>
                <X /> Remover logo
              </Button>
            </div>
          ) : (
            <FileDropzone purpose="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" hint="SVG, PNG, JPG ou WebP até 2 MB · fundo transparente de preferência" onUploaded={(f) => form.set("logoUrl", f.url)} />
          )}
          {fe.logoUrl && <p className="text-caption font-medium text-danger">{fe.logoUrl}</p>}
        </div>
      </SettingsSection>

      <SettingsSection title="Contato" description="Exibido no rodapé e nas mensagens de suporte.">
        <div className={cn(pad, "sm:grid-cols-2")}>
          <Field label="E-mail de contato" error={fe.contactEmail}>
            <Input type="email" value={v.contactEmail} maxLength={120} onChange={(e) => form.set("contactEmail", e.target.value.trim())} />
          </Field>
          <Field label="Telefone / WhatsApp" error={fe.contactPhone}>
            <Input type="tel" value={v.contactPhone} maxLength={30} onChange={(e) => form.set("contactPhone", e.target.value)} placeholder="(11) 99999-9999" />
          </Field>
        </div>
      </SettingsSection>
      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} />
    </form>
  );
}

// ── Aparência ───────────────────────────────────────

export type AppearanceValues = { primaryColor: string; accentColor: string; defaultTheme: "system" | "light" | "dark"; headingFont: "serif" | "sans" };
export const APPEARANCE_DEFAULTS: AppearanceValues = { primaryColor: "#1F5B4B", accentColor: "#B7832F", defaultTheme: "system", headingFont: "serif" };

function ColorField({ label, value, onChange, error, hint }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: React.ReactNode }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={isHex(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-1 sm:h-9"
          aria-label={`${label}: seletor`}
        />
        <Input id={id} value={value} maxLength={7} onChange={(e) => onChange(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)} className="font-mono uppercase" aria-invalid={!!error || !isHex(value) || undefined} />
      </div>
      {error ? <p className="text-caption font-medium text-danger">{error}</p> : hint}
    </div>
  );
}

/** Reproduz as fórmulas de globals.css para os tokens de marca, no escopo da prévia. */
function previewCss(brand: string, accent: string) {
  return `.appearance-preview{--primary:${brand};--primary-hover:color-mix(in oklab,${brand} 86%,black);--primary-fg:#fff;--primary-soft:color-mix(in oklab,${brand} 9%,white);--primary-soft-fg:color-mix(in oklab,${brand} 88%,black);--accent:${accent};--accent-soft:color-mix(in oklab,${accent} 13%,white);--accent-soft-fg:color-mix(in oklab,${accent} 70%,black);--ring:color-mix(in oklab,${brand} 55%,transparent)}
.dark .appearance-preview{--primary:color-mix(in oklab,${brand} 62%,white);--primary-hover:color-mix(in oklab,${brand} 52%,white);--primary-fg:#0d0e0d;--primary-soft:color-mix(in oklab,${brand} 22%,#141615);--primary-soft-fg:color-mix(in oklab,${brand} 45%,white);--accent:color-mix(in oklab,${accent} 80%,white);--accent-soft:color-mix(in oklab,${accent} 18%,#141615);--accent-soft-fg:color-mix(in oklab,${accent} 55%,white)}`;
}

export function AppearanceForm({ initial }: { initial: AppearanceValues }) {
  const { form, act, fe, onSubmit } = useGroupForm("appearance", initial);
  const v = form.values;
  const brand = isHex(v.primaryColor) ? v.primaryColor : APPEARANCE_DEFAULTS.primaryColor;
  const accent = isHex(v.accentColor) ? v.accentColor : APPEARANCE_DEFAULTS.accentColor;
  const ratio = contrast(brand, "#FFFFFF");
  const ok = ratio >= 4.5;
  const headingFont = v.headingFont === "sans" ? "var(--font-sans)" : `"Fraunces Variable", ui-serif, Georgia, serif`;
  const isDefault = JSON.stringify(v) === JSON.stringify(APPEARANCE_DEFAULTS);

  return (
    <form onSubmit={onSubmit}>
      <SettingsSection title="Cores da marca" description="A cor primária aparece em botões, links e destaques; a de destaque, em selos e detalhes.">
        <div className={pad}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label="Cor primária"
              value={v.primaryColor}
              onChange={(c) => form.set("primaryColor", c)}
              error={fe.primaryColor}
              hint={
                <p className={cn("inline-flex items-center gap-1.5 text-caption font-medium", ok ? "text-success" : "text-warning")}>
                  {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                  Contraste com branco: {ratio.toFixed(2)}:1 {ok ? "· adequado (AA)" : "· abaixo de 4,5:1"}
                </p>
              }
            />
            <ColorField label="Cor de destaque" value={v.accentColor} onChange={(c) => form.set("accentColor", c)} error={fe.accentColor} />
          </div>
          {!ok && (
            <Alert tone="warning" title="Texto branco pode ficar difícil de ler">
              Botões usam texto branco sobre a cor primária. Com contraste abaixo de 4,5:1, pessoas com baixa visão podem não conseguir ler. Escolha um tom mais escuro.
            </Alert>
          )}
          {!isDefault && (
            <div>
              <Button type="button" variant="link" size="sm" onClick={() => form.setValues(APPEARANCE_DEFAULTS)}>
                Restaurar padrão da Escola
              </Button>
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Tipografia e tema">
        <div className={cn(pad, "sm:grid-cols-2")}>
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium" id="font-label">Fonte dos títulos</span>
            <Tabs value={v.headingFont} onValueChange={(x) => form.set("headingFont", x as AppearanceValues["headingFont"])}>
              <SegmentedList aria-labelledby="font-label">
                <SegmentedTrigger value="serif"><span style={{ fontFamily: `"Fraunces Variable", serif` }}>Serifada</span></SegmentedTrigger>
                <SegmentedTrigger value="sans">Sem serifa</SegmentedTrigger>
              </SegmentedList>
            </Tabs>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium" id="theme-label">Tema padrão</span>
            <Tabs value={v.defaultTheme} onValueChange={(x) => form.set("defaultTheme", x as AppearanceValues["defaultTheme"])}>
              <SegmentedList aria-labelledby="theme-label">
                <SegmentedTrigger value="system">Sistema</SegmentedTrigger>
                <SegmentedTrigger value="light">Claro</SegmentedTrigger>
                <SegmentedTrigger value="dark">Escuro</SegmentedTrigger>
              </SegmentedList>
            </Tabs>
            <p className="text-caption text-subtle">Vale para quem ainda não escolheu um tema no próprio dispositivo.</p>
          </div>
        </div>
      </SettingsSection>

      <section className="mb-8">
        <h2 className="text-h3">Pré-visualização</h2>
        <p className="mt-0.5 text-small text-muted">Como os componentes ficam com as escolhas acima (no tema atual da sua tela).</p>
        <style>{previewCss(brand, accent)}</style>
        <div className="appearance-preview mt-4 grid gap-4 rounded-xl border border-border bg-bg p-4 sm:grid-cols-[1.2fr_1fr] sm:p-5">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
            <p className="text-overline text-primary">Teologia · 12 aulas</p>
            <p className="mt-2 text-h2 text-balance" style={{ fontFamily: headingFont }}>Hermenêutica: como interpretar a Bíblia</p>
            <p className="mt-2 text-small text-muted">Um método prático para ler o texto com fidelidade.</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full w-3/5 rounded-full bg-primary" /></div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" tabIndex={-1}>Continuar curso</Button>
              <Button type="button" variant="outline" tabIndex={-1}>Detalhes</Button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="primary">Matriculado</Badge>
              <Badge tone="accent">Destaque</Badge>
              <Badge tone="success" dot>Concluído</Badge>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm">Você tem <a className="font-medium text-primary underline-offset-4 hover:underline">2 atividades</a> para esta semana.</p>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-primary-soft px-3 py-2.5 text-small text-primary-soft-fg">
              <Check className="size-4" /> Certificado emitido
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-accent-soft px-3 py-2.5 text-small text-accent-soft-fg">
              <ImageIcon className="size-4" /> Novo banner na home
            </div>
          </div>
        </div>
      </section>
      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} />
    </form>
  );
}

// ── Usuários ────────────────────────────────────────

export function UsersForm({ initial }: { initial: { allowRegistration: boolean; requireEmailVerification: boolean } }) {
  const { form, act, onSubmit } = useGroupForm("users", initial);
  const v = form.values;
  return (
    <form onSubmit={onSubmit}>
      <SettingsSection title="Cadastro" description="Como novas pessoas entram na plataforma.">
        <ToggleRow
          label="Cadastro aberto"
          description="Qualquer pessoa pode criar conta como aluno. Desligado, só a administração cria contas (Usuários › Novo)."
          checked={v.allowRegistration}
          onChange={(x) => form.set("allowRegistration", x)}
        />
        <ToggleRow
          label="Exigir verificação de e-mail"
          description="A pessoa precisa confirmar o e-mail pelo link enviado antes de acessar os cursos."
          checked={v.requireEmailVerification}
          onChange={(x) => form.set("requireEmailVerification", x)}
        />
      </SettingsSection>
      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} />
    </form>
  );
}

// ── Cursos ──────────────────────────────────────────

export function CoursesForm({ initial }: { initial: { requireReview: boolean; allowSelfEnrollment: boolean; autoIssueCertificates: boolean; certificatePrefix: string } }) {
  const { form, act, fe, onSubmit } = useGroupForm("courses", initial);
  const v = form.values;
  return (
    <form onSubmit={onSubmit}>
      <SettingsSection title="Publicação e matrícula">
        <ToggleRow
          label="Exigir revisão antes de publicar"
          description="Professores enviam o curso para revisão; a administração aprova em Cursos › Aguardando revisão. Quem tem a permissão “Publicar cursos sem revisão” publica direto."
          checked={v.requireReview}
          onChange={(x) => form.set("requireReview", x)}
        />
        <ToggleRow
          label="Permitir auto-matrícula"
          description="Alunos se matriculam sozinhos nos cursos publicados. Desligado, a matrícula é feita pela administração."
          checked={v.allowSelfEnrollment}
          onChange={(x) => form.set("allowSelfEnrollment", x)}
        />
      </SettingsSection>
      <SettingsSection title="Certificados">
        <ToggleRow
          label="Emitir certificados automaticamente"
          description="Ao concluir 100% do curso, o certificado é gerado e enviado ao aluno. Desligado, emita em Certificados › Emitir manualmente."
          checked={v.autoIssueCertificates}
          onChange={(x) => form.set("autoIssueCertificates", x)}
        />
        <div className="px-4 py-4 sm:px-5">
          <Field label="Prefixo do código" error={fe.certificatePrefix} hint={`Exemplo de código: ${v.certificatePrefix || "EBA"}-2026-7K3P-QX9M · vale para novos certificados.`}>
            <Input value={v.certificatePrefix} maxLength={6} onChange={(e) => form.set("certificatePrefix", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} className="max-w-40 font-mono uppercase" />
          </Field>
        </div>
      </SettingsSection>
      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} />
    </form>
  );
}

// ── Comunicação ─────────────────────────────────────

export function CommunicationForm({
  initial,
  provider,
}: {
  initial: { emailNotifications: boolean; supportEnabled: boolean; emailSignature: string };
  provider: { provider: "log" | "resend" | "smtp"; from: string; configured: boolean };
}) {
  const { form, act, fe, onSubmit } = useGroupForm("communication", initial);
  const v = form.values;
  const names = { log: "Registro local (modo demonstração)", resend: "Resend", smtp: "Servidor SMTP" };
  return (
    <form onSubmit={onSubmit}>
      <SettingsSection title="Provedor de e-mail" description="Definido pela variável de ambiente EMAIL_PROVIDER no servidor (log, resend ou smtp).">
        <div className={pad}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium">{names[provider.provider]}</p>
            {provider.provider === "log" ? (
              <Badge tone="warning" dot>E-mails não saem do servidor</Badge>
            ) : provider.configured ? (
              <Badge tone="success" dot>Ativo</Badge>
            ) : (
              <Badge tone="danger" dot>Credencial ausente</Badge>
            )}
          </div>
          <p className="text-small text-muted">Remetente: <span className="font-mono text-caption">{provider.from}</span></p>
          {provider.provider === "log" && (
            <Alert tone="info">
              No modo <strong>log</strong>, cada e-mail (confirmação de conta, redefinição de senha, certificados, comunicados) é gravado na caixa de saída e pode ser lido em{" "}
              <a href="/admin/logs?tab=emails" className="font-medium underline underline-offset-2">Logs › E-mails</a>. Para enviar de verdade, configure <span className="font-mono">EMAIL_PROVIDER=resend</span> com <span className="font-mono">RESEND_API_KEY</span>, ou <span className="font-mono">EMAIL_PROVIDER=smtp</span> com <span className="font-mono">SMTP_URL</span>, e reinicie o servidor.
            </Alert>
          )}
          {provider.provider !== "log" && !provider.configured && (
            <Alert tone="danger">A variável {provider.provider === "resend" ? "RESEND_API_KEY" : "SMTP_URL"} não está definida: os envios vão falhar e aparecerão como “Falhou” em Logs › E-mails.</Alert>
          )}
        </div>
      </SettingsSection>
      <SettingsSection title="Mensagens">
        <ToggleRow label="Notificações por e-mail" description="Envia por e-mail, além da notificação na plataforma, avisos como comunicados e correções." checked={v.emailNotifications} onChange={(x) => form.set("emailNotifications", x)} />
        <ToggleRow label="Canal de suporte" description="Alunos podem abrir conversas de suporte, atendidas por quem tem a permissão “Atender suporte”." checked={v.supportEnabled} onChange={(x) => form.set("supportEnabled", x)} />
        <div className="px-4 py-4 sm:px-5">
          <Field label="Assinatura dos e-mails" error={fe.emailSignature}>
            <Textarea value={v.emailSignature} maxLength={300} rows={2} onChange={(e) => form.set("emailSignature", e.target.value)} />
          </Field>
        </div>
      </SettingsSection>
      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} />
    </form>
  );
}

// ── Segurança ───────────────────────────────────────

export function SecurityForm({ initial }: { initial: { minPasswordLength: number; maxLoginAttempts: number; twoFactorEnabled: boolean } }) {
  const { form, act, fe, onSubmit } = useGroupForm("security", initial);
  const v = form.values;
  return (
    <form onSubmit={onSubmit}>
      <SettingsSection title="Senhas e acesso">
        <div className={cn(pad, "sm:grid-cols-2")}>
          <Field label="Tamanho mínimo da senha" error={fe.minPasswordLength} hint="Entre 8 e 64 caracteres. Vale para novas senhas.">
            <Input type="number" min={8} max={64} value={v.minPasswordLength} onChange={(e) => form.set("minPasswordLength", Number(e.target.value))} className="max-w-32" />
          </Field>
          <Field label="Tentativas de login antes do bloqueio" error={fe.maxLoginAttempts} hint="Por e-mail e IP, em uma janela de 15 minutos.">
            <Input type="number" min={3} max={50} value={v.maxLoginAttempts} onChange={(e) => form.set("maxLoginAttempts", Number(e.target.value))} className="max-w-32" />
          </Field>
        </div>
        <ToggleRow
          label="Verificação em duas etapas (2FA)"
          badge={<Badge tone="neutral"><Lock /> Em breve</Badge>}
          description="A estrutura está preparada, mas o 2FA ainda não foi implementado. Esta opção permanece desligada até a funcionalidade ser lançada."
          checked={false}
          disabled
        />
      </SettingsSection>
      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} />
    </form>
  );
}

// ── Integrações (analytics) ─────────────────────────

export function AnalyticsForm({ initial }: { initial: { gaMeasurementId: string; metaPixelId: string } }) {
  const { form, act, fe, onSubmit } = useGroupForm("integrations", initial);
  const v = form.values;
  return (
    <form onSubmit={onSubmit}>
      <SettingsSection title="Análise de audiência" description="Os scripts só são carregados quando um ID está preenchido.">
        <div className={cn(pad, "sm:grid-cols-2")}>
          <Field label="Google Analytics 4 (ID de medição)" error={fe.gaMeasurementId} hint={v.gaMeasurementId ? "Ativo no site." : "Vazio: desativado."}>
            <Input value={v.gaMeasurementId} maxLength={20} placeholder="G-XXXXXXXXXX" onChange={(e) => form.set("gaMeasurementId", e.target.value.trim().toUpperCase())} className="font-mono" />
          </Field>
          <Field label="Meta Pixel (ID)" error={fe.metaPixelId} hint={v.metaPixelId ? "Ativo no site." : "Vazio: desativado."}>
            <Input value={v.metaPixelId} maxLength={20} inputMode="numeric" placeholder="123456789012345" onChange={(e) => form.set("metaPixelId", e.target.value.trim())} className="font-mono" />
          </Field>
        </div>
      </SettingsSection>
      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} />
    </form>
  );
}
