"use client";
import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAction } from "@/hooks/use-action";
import { updateSettingsAction } from "@/app/(app)/teacher/courses/[id]/actions";
import { formatMoney } from "@/lib/format";
import { SaveBar } from "./form-helpers";

export type CourseSettingsValue = {
  courseId: string;
  sequential: boolean;
  certificateEnabled: boolean;
  certificateTemplateId: string;
  priceCents: number;
  isFeatured: boolean;
};

function ToggleRow({ title, description, checked, onChange, disabled, badge }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; badge?: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
          {title} {badge}
        </label>
        <p id={`${id}-d`} className="mt-0.5 text-small text-muted">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} aria-describedby={`${id}-d`} className="mt-0.5" />
    </div>
  );
}

export function CourseSettingsForm({
  initial,
  templates,
  canFeature,
}: {
  initial: CourseSettingsValue;
  templates: { id: string; name: string; isDefault: boolean }[];
  canFeature: boolean;
}) {
  const [v, setV] = useState(initial);
  const [base, setBase] = useState(initial);
  const [price, setPrice] = useState(initial.priceCents ? (initial.priceCents / 100).toFixed(2).replace(".", ",") : "");
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setBase(initial);
    setV(initial);
  }
  const { run, pending, fieldErrors } = useAction(updateSettingsAction, { errorToast: true });
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  const set = <K extends keyof CourseSettingsValue>(k: K, val: CourseSettingsValue[K]) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ ...v, certificateTemplateId: v.certificateTemplateId || null, ...(canFeature ? {} : { isFeatured: undefined }) });
    if (res?.ok) setBase(v);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface px-4 shadow-xs sm:px-5">
        <h3 className="pt-4 text-h4">Aprendizagem</h3>
        <div className="divide-y divide-border">
          <ToggleRow
            title="Liberação sequencial"
            description="Cada aula só é liberada depois que o aluno conclui a anterior."
            checked={v.sequential}
            onChange={(x) => set("sequential", x)}
          />
          {canFeature && (
            <ToggleRow
              title="Destaque na página inicial"
              badge={<Badge tone="accent">Administração</Badge>}
              description="Mostra o curso na seção de destaques do site."
              checked={v.isFeatured}
              onChange={(x) => set("isFeatured", x)}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface px-4 pb-4 shadow-xs sm:px-5">
        <h3 className="pt-4 text-h4">Certificado</h3>
        <ToggleRow
          title="Emitir certificado ao concluir"
          description="Gerado automaticamente quando o aluno conclui 100% das aulas publicadas."
          checked={v.certificateEnabled}
          onChange={(x) => set("certificateEnabled", x)}
        />
        <Field label="Modelo de certificado" error={fieldErrors.certificateTemplateId} className="sm:max-w-sm">
          <NativeSelect value={v.certificateTemplateId} onChange={(e) => set("certificateTemplateId", e.target.value)} disabled={!v.certificateEnabled}>
            <option value="">Modelo padrão da escola</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? " (padrão)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
        <h3 className="text-h4">Preço</h3>
        <p className="mt-1 mb-4 text-small text-muted">Deixe em branco ou zero para um curso gratuito.</p>
        <Alert tone="warning" title="Pagamento online ainda não disponível" className="mb-4">
          A escola ainda não tem um meio de pagamento integrado. Se você definir um preço, o curso aparece como pago no catálogo, mas os alunos não conseguem se inscrever sozinhos: a matrícula precisa ser feita pela secretaria.
        </Alert>
        <Field label="Preço (R$)" error={fieldErrors.priceCents} hint={v.priceCents ? `Será exibido como ${formatMoney(v.priceCents)}` : "Curso gratuito"} className="sm:max-w-56">
          <Input
            inputMode="decimal"
            value={price}
            placeholder="0,00"
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d,]/g, "");
              setPrice(raw);
              const n = Number(raw.replace(",", "."));
              set("priceCents", Number.isFinite(n) ? Math.round(n * 100) : 0);
            }}
          />
        </Field>
      </section>

      <SaveBar
        dirty={dirty}
        pending={pending}
        onReset={() => {
          setV(base);
          setPrice(base.priceCents ? (base.priceCents / 100).toFixed(2).replace(".", ",") : "");
        }}
      />
    </form>
  );
}
