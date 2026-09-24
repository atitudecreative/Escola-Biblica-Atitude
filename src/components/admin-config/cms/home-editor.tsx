"use client";
import { useState } from "react";
import { Plus, Quote, Sparkles, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useAction } from "@/hooks/use-action";
import { SortableList } from "../sortable-list";
import { SaveBar } from "../save-bar";
import { useDirtyForm } from "../use-dirty-form";
import { IconPicker } from "../icon-picker";
import { CourseThumb } from "../course-thumb";
import { saveHomeAction } from "@/app/(app)/admin/banners/actions";

type Sections = Record<"featured" | "categories" | "continue" | "popular" | "newest" | "teachers" | "testimonials" | "benefits" | "cta", boolean>;
export type HomeSettings = {
  sections: Sections;
  featuredCourseIds: string[];
  testimonials: { name: string; role: string; quote: string }[];
  benefits: { icon: string; title: string; text: string }[];
  ctaTitle: string;
  ctaText: string;
};
export type PickerCourse = { id: string; title: string; coverUrl: string | null; teacher: string; category: string | null };

// Ordem em que as seções aparecem na Home. "popular"/"newest" seguem no schema por compatibilidade,
// mas a Home agora tem um único explorador por área (ordenado por procura).
const SECTION_LABELS: { key: keyof Sections; label: string; hint: string }[] = [
  { key: "continue", label: "Continue de onde parou", hint: "Só para quem está logado e já estuda" },
  { key: "featured", label: "Comece por aqui", hint: "Até 3 cursos da seleção abaixo" },
  { key: "categories", label: "Explore por área", hint: "Catálogo filtrável por categoria" },
  { key: "benefits", label: "Benefícios", hint: "Aparecem em “Como funciona”, para quem ainda não estuda" },
  { key: "teachers", label: "Professores", hint: "Quem ensina na Escola" },
  { key: "testimonials", label: "Depoimentos", hint: "Até 3, editados abaixo" },
  { key: "cta", label: "Chamada final", hint: "Convite para criar conta (só visitantes)" },
];

let uid = 0;
const withIds = <T,>(xs: T[]) => xs.map((x) => ({ ...x, _id: `k${++uid}` }));
const stripIds = <T extends { _id: string }>(xs: T[]) => xs.map(({ _id, ...rest }) => (void _id, rest));

export function HomeEditor({ initial, courses }: { initial: HomeSettings; courses: PickerCourse[] }) {
  const form = useDirtyForm({
    ...initial,
    testimonials: withIds(initial.testimonials),
    benefits: withIds(initial.benefits),
  });
  const v = form.values;
  const act = useAction(saveHomeAction, { errorToast: true, onSuccess: () => form.commit() });
  const fe = act.fieldErrors;
  const [adding, setAdding] = useState("");
  const byId = new Map(courses.map((c) => [c.id, c]));
  const available = courses.filter((c) => !v.featuredCourseIds.includes(c.id));
  const featured = v.featuredCourseIds.map((id) => ({ id, course: byId.get(id) }));

  function patchList<K extends "testimonials" | "benefits">(key: K, i: number, patch: Partial<(typeof v)[K][number]>) {
    form.set(key, v[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) as (typeof v)[K]);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        act.run({ ...v, testimonials: stripIds(v.testimonials), benefits: stripIds(v.benefits) });
      }}
      className="space-y-10"
    >
      <section aria-labelledby="home-sections">
        <h2 id="home-sections" className="text-h3">Seções da home</h2>
        <p className="mt-0.5 mb-4 text-small text-muted">Ligue ou desligue blocos da página inicial. O slider de banners é sempre exibido.</p>
        <div className="grid overflow-hidden rounded-xl border border-border bg-surface shadow-xs sm:grid-cols-2">
          {SECTION_LABELS.map((s) => (
            <label key={s.key} className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-4 py-3 sm:odd:border-r">
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-caption text-subtle">{s.hint}</span>
              </span>
              <Switch checked={v.sections[s.key]} onCheckedChange={(on) => form.set("sections", { ...v.sections, [s.key]: on })} />
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="home-featured">
        <h2 id="home-featured" className="text-h3">Cursos em destaque</h2>
        <p className="mt-0.5 mb-4 text-small text-muted">Até 12 cursos publicados, na ordem em que aparecem. Sem seleção, a home usa os marcados como destaque em Cursos.</p>
        {featured.length === 0 ? (
          <EmptyState compact icon={Star} title="Nenhum curso selecionado" description="Adicione cursos publicados pelo campo abaixo." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <SortableList
              items={featured}
              label="curso"
              onReorder={(ids) => form.set("featuredCourseIds", ids)}
              className="divide-y divide-border"
              itemClassName="px-2 py-2 sm:px-3"
              renderItem={(f, i) => (
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-caption font-semibold text-subtle tabular-nums">{i + 1}</span>
                  <CourseThumb title={f.course?.title ?? "Curso"} src={f.course?.coverUrl} className="w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.course?.title ?? "Curso indisponível (não publicado)"}</p>
                    <p className="truncate text-caption text-subtle">{f.course ? [f.course.teacher, f.course.category].filter(Boolean).join(" · ") : "Remova da lista"}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover dos destaques" onClick={() => form.set("featuredCourseIds", v.featuredCourseIds.filter((x) => x !== f.id))}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            />
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <NativeSelect aria-label="Escolher curso para destacar" value={adding} onChange={(e) => setAdding(e.target.value)} disabled={v.featuredCourseIds.length >= 12 || !available.length}>
            <option value="">{available.length ? "Escolha um curso publicado…" : "Todos os cursos publicados já estão na lista"}</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant="outline"
            disabled={!adding || v.featuredCourseIds.length >= 12}
            onClick={() => {
              form.set("featuredCourseIds", [...v.featuredCourseIds, adding]);
              setAdding("");
            }}
          >
            <Plus /> Adicionar
          </Button>
        </div>
        {fe.featuredCourseIds && <p className="mt-1 text-caption font-medium text-danger">{fe.featuredCourseIds}</p>}
      </section>

      <section aria-labelledby="home-testimonials">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="home-testimonials" className="text-h3">Depoimentos</h2>
            <p className="mt-0.5 text-small text-muted">Até 9. Use falas reais, com autorização de quem falou.</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={v.testimonials.length >= 9} onClick={() => form.set("testimonials", [...v.testimonials, ...withIds([{ name: "", role: "", quote: "" }])])}>
            <Plus /> Adicionar depoimento
          </Button>
        </div>
        {v.testimonials.length === 0 ? (
          <EmptyState compact icon={Quote} title="Nenhum depoimento" description="A seção fica oculta enquanto não houver depoimentos." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <SortableList
              items={v.testimonials.map((t) => ({ ...t, id: t._id }))}
              label="depoimento"
              onReorder={(ids) => form.set("testimonials", ids.map((id) => v.testimonials.find((t) => t._id === id)!))}
              className="divide-y divide-border"
              itemClassName="items-start px-2 py-3 sm:px-3 [&>button:first-child]:mt-6"
              renderItem={(t, i) => (
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Nome" error={fe[`testimonials.${i}.name`]}>
                    <Input value={t.name} maxLength={60} onChange={(e) => patchList("testimonials", i, { name: e.target.value })} required />
                  </Field>
                  <Field label="Função ou turma" error={fe[`testimonials.${i}.role`]}>
                    <Input value={t.role} maxLength={80} onChange={(e) => patchList("testimonials", i, { role: e.target.value })} placeholder="Ex.: Aluna de Hermenêutica" />
                  </Field>
                  <div className="flex items-end">
                    <Button type="button" variant="danger-ghost" size="icon" aria-label="Remover depoimento" onClick={() => form.set("testimonials", v.testimonials.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                  <Field label="Depoimento" className="sm:col-span-3" error={fe[`testimonials.${i}.quote`]}>
                    <Textarea value={t.quote} maxLength={400} rows={2} onChange={(e) => patchList("testimonials", i, { quote: e.target.value })} required />
                  </Field>
                </div>
              )}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="home-benefits">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="home-benefits" className="text-h3">Benefícios</h2>
            <p className="mt-0.5 text-small text-muted">Até 6 pontos curtos sobre por que estudar na Escola.</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={v.benefits.length >= 6} onClick={() => form.set("benefits", [...v.benefits, ...withIds([{ icon: "star", title: "", text: "" }])])}>
            <Plus /> Adicionar benefício
          </Button>
        </div>
        {v.benefits.length === 0 ? (
          <EmptyState compact icon={Sparkles} title="Nenhum benefício" description="A seção fica oculta enquanto não houver itens." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <SortableList
              items={v.benefits.map((b) => ({ ...b, id: b._id }))}
              label="benefício"
              onReorder={(ids) => form.set("benefits", ids.map((id) => v.benefits.find((b) => b._id === id)!))}
              className="divide-y divide-border"
              itemClassName="items-start px-2 py-3 sm:px-3 [&>button:first-child]:mt-6"
              renderItem={(b, i) => (
                <div className="grid gap-3 sm:grid-cols-[11rem_1fr_auto]">
                  <Field label="Ícone">
                    <IconPicker value={b.icon} allowNone={false} onChange={(ic) => patchList("benefits", i, { icon: ic ?? "star" })} />
                  </Field>
                  <Field label="Título" error={fe[`benefits.${i}.title`]}>
                    <Input value={b.title} maxLength={60} onChange={(e) => patchList("benefits", i, { title: e.target.value })} required />
                  </Field>
                  <div className="flex items-end">
                    <Button type="button" variant="danger-ghost" size="icon" aria-label="Remover benefício" onClick={() => form.set("benefits", v.benefits.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                  <Field label="Texto" className="sm:col-span-3" error={fe[`benefits.${i}.text`]}>
                    <Textarea value={b.text} maxLength={200} rows={2} onChange={(e) => patchList("benefits", i, { text: e.target.value })} />
                  </Field>
                </div>
              )}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="home-cta">
        <h2 id="home-cta" className="text-h3">Chamada final</h2>
        <p className="mt-0.5 mb-4 text-small text-muted">Bloco no fim da home convidando o visitante a criar conta.</p>
        <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
          <Field label="Título" error={fe.ctaTitle}>
            <Input value={v.ctaTitle} maxLength={100} onChange={(e) => form.set("ctaTitle", e.target.value)} />
          </Field>
          <Field label="Texto" error={fe.ctaText}>
            <Textarea value={v.ctaText} maxLength={240} rows={2} onChange={(e) => form.set("ctaText", e.target.value)} />
          </Field>
        </div>
      </section>

      <SaveBar dirty={form.dirty} pending={act.pending} onReset={form.reset} label="Salvar home" />
    </form>
  );
}
