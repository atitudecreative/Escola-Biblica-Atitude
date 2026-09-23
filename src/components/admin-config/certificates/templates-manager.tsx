"use client";
import { useRef, useState } from "react";
import { Check, FileDown, FileText, MoreHorizontal, PencilLine, Plus, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { useAction } from "@/hooks/use-action";
import { pluralize } from "@/lib/format";
import { CertificatePreview, type TemplateDraft } from "./certificate-preview";
import { deleteTemplateAction, saveTemplateAction, setDefaultTemplateAction } from "@/app/(app)/admin/certificates/actions";

export type TemplateRow = TemplateDraft & { id: string; name: string; isDefault: boolean; courses: number; certificates: number };

const PLACEHOLDERS = [
  { k: "aluno", label: "Aluno" },
  { k: "curso", label: "Curso" },
  { k: "carga", label: "Carga horária" },
  { k: "data", label: "Data" },
  { k: "professor", label: "Professor" },
];

const BLANK: Omit<TemplateRow, "id" | "courses" | "certificates"> = {
  name: "",
  heading: "Certificado de Conclusão",
  body: "concluiu com aproveitamento o curso {{curso}}, ministrado por {{professor}}, com carga horária de {{carga}} horas, em {{data}}.",
  signatureName: "",
  signatureRole: "Coordenação",
  accentColor: "#1F5B4B",
  isDefault: false,
};

function previewHref(t: TemplateDraft) {
  const sp = new URLSearchParams({ heading: t.heading, body: t.body, signatureName: t.signatureName, signatureRole: t.signatureRole, accentColor: t.accentColor });
  return `/api/admin/certificates/preview?${sp}`;
}

export function TemplatesManager({ templates, platformName }: { templates: TemplateRow[]; platformName: string }) {
  const [editing, setEditing] = useState<TemplateRow | "new" | null>(null);
  const confirm = useConfirm();
  const setDefault = useAction(setDefaultTemplateAction, { errorToast: true });
  const del = useAction(deleteTemplateAction, { errorToast: true });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-h3">Modelos</h2>
          <p className="mt-0.5 text-small text-muted">O modelo padrão é usado por cursos sem modelo próprio. Alterações valem para novos PDFs, inclusive de certificados já emitidos.</p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus /> Novo modelo</Button>
      </div>
      {templates.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum modelo" description="Crie um modelo para personalizar o texto, a cor e a assinatura dos certificados." action={<Button onClick={() => setEditing("new")}><Plus /> Criar modelo</Button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id} className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
              <button type="button" onClick={() => setEditing(t)} className="block w-full bg-surface-2 p-3" aria-label={`Editar ${t.name}`}>
                <CertificatePreview t={t} platformName={platformName} />
              </button>
              <div className="flex items-start gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{t.name}</p>
                    {t.isDefault && <Badge tone="primary">Padrão</Badge>}
                  </div>
                  <p className="mt-0.5 text-caption text-subtle">
                    {pluralize(t.courses, "curso", "cursos")} · {pluralize(t.certificates, "certificado", "certificados")}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${t.name}`}><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setEditing(t)}><PencilLine /> Editar</DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/api/admin/certificates/preview?templateId=${t.id}`} target="_blank" rel="noopener"><FileDown /> PDF de exemplo</a>
                    </DropdownMenuItem>
                    {!t.isDefault && (
                      <DropdownMenuItem onSelect={() => setDefault.run(t.id)}><Star /> Tornar padrão</DropdownMenuItem>
                    )}
                    {!t.isDefault && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          tone="danger"
                          onSelect={async () => {
                            const ok = await confirm({
                              title: `Excluir "${t.name}"?`,
                              description:
                                t.courses || t.certificates
                                  ? `${pluralize(t.courses, "curso", "cursos")} e ${pluralize(t.certificates, "certificado", "certificados")} passarão a usar o modelo padrão.`
                                  : "O modelo não está em uso.",
                              confirmLabel: "Excluir modelo",
                            });
                            if (ok) del.run(t.id);
                          }}
                        >
                          <Trash2 /> Excluir
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TemplateDialog
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          platformName={platformName}
          firstTemplate={templates.length === 0}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function TemplateDialog({ initial, platformName, firstTemplate, onClose }: { initial: TemplateRow | null; platformName: string; firstTemplate: boolean; onClose: () => void }) {
  const [t, setT] = useState(initial ?? { ...BLANK, isDefault: firstTemplate });
  const set = <K extends keyof typeof t>(k: K, v: (typeof t)[K]) => setT((x) => ({ ...x, [k]: v }));
  const bodyWrap = useRef<HTMLDivElement>(null);
  const act = useAction(saveTemplateAction, { onSuccess: onClose });
  const fe = act.fieldErrors;

  function insert(k: string) {
    const el = bodyWrap.current?.querySelector("textarea");
    const token = `{{${k}}}`;
    if (!el) return set("body", t.body + token);
    const s = el.selectionStart ?? t.body.length;
    const e = el.selectionEnd ?? s;
    set("body", t.body.slice(0, s) + token + t.body.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        title={initial ? "Editar modelo" : "Novo modelo de certificado"}
        footer={
          <>
            <Button variant="ghost" asChild className="sm:mr-auto">
              <a href={previewHref(t)} target="_blank" rel="noopener"><FileDown /> Baixar PDF de exemplo</a>
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="tpl-form" loading={act.pending}><Check /> Salvar modelo</Button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form id="tpl-form" className="grid content-start gap-4" onSubmit={(e) => { e.preventDefault(); act.run({ ...t, id: initial?.id }); }}>
            <Field label="Nome interno" required error={fe.name} hint="Só a equipe vê este nome.">
              <Input value={t.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Cursos de liderança" autoFocus={!initial} />
            </Field>
            <Field label="Título do certificado" required error={fe.heading}>
              <Input value={t.heading} maxLength={60} onChange={(e) => set("heading", e.target.value)} />
            </Field>
            <div ref={bodyWrap} className="grid gap-4">
            <Field
              label="Texto"
              required
              error={fe.body}
              labelAction={<span className="text-caption text-subtle">{t.body.length}/600</span>}
              hint='Aparece depois de "Certificamos que [nome do aluno]".'
            >
              <Textarea value={t.body} maxLength={600} rows={5} onChange={(e) => set("body", e.target.value)} />
            </Field>
            <div className="-mt-2 flex flex-wrap gap-1.5" aria-label="Inserir marcador">
              {PLACEHOLDERS.map((p) => (
                <button key={p.k} type="button" onClick={() => insert(p.k)} className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2 px-2 font-mono text-caption text-muted hover:border-border-strong hover:text-fg" title={`Inserir ${p.label}`}>
                  {`{{${p.k}}}`}
                </button>
              ))}
            </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Assinatura (nome)" required error={fe.signatureName}>
                <Input value={t.signatureName} maxLength={60} onChange={(e) => set("signatureName", e.target.value)} />
              </Field>
              <Field label="Cargo" required error={fe.signatureRole}>
                <Input value={t.signatureRole} maxLength={80} onChange={(e) => set("signatureRole", e.target.value)} />
              </Field>
            </div>
            <Field label="Cor de destaque" error={fe.accentColor}>
              <div className="flex gap-2">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(t.accentColor) ? t.accentColor : "#1F5B4B"} onChange={(e) => set("accentColor", e.target.value.toUpperCase())} className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-1 sm:h-9" aria-label="Escolher cor" />
                <Input value={t.accentColor} maxLength={7} onChange={(e) => set("accentColor", e.target.value)} className="font-mono uppercase" aria-label="Cor em hexadecimal" />
              </div>
            </Field>
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={t.isDefault} disabled={initial?.isDefault} onCheckedChange={(v) => set("isDefault", v === true)} />
              Usar como modelo padrão
              {initial?.isDefault && <span className="text-caption text-subtle">(defina outro como padrão para trocar)</span>}
            </label>
            {act.error && !Object.keys(fe).length && <p className="text-small text-danger">{act.error}</p>}
          </form>
          <div className="lg:sticky lg:top-0 lg:self-start">
            <p className="mb-2 text-overline text-subtle">Pré-visualização com dados de exemplo</p>
            <div className="rounded-lg bg-surface-2 p-3">
              <CertificatePreview t={t} platformName={platformName} />
            </div>
            <p className="mt-2 text-caption text-subtle">O PDF final usa fontes padrão (Times/Helvetica) e inclui QR Code de validação.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
