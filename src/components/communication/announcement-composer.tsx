"use client";
import { useEffect, useState } from "react";
import { Megaphone, Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { countAudienceAction, searchTargetsAction, sendAnnouncementAction } from "@/app/(app)/announcements/actions";
import { MarkdownEditor } from "./markdown-editor";

type Audience = "ALL" | "ROLE" | "COURSE" | "USER";
type Course = { id: string; title: string; students: number };
type Target = { id: string; name: string; email: string; avatarUrl: string | null };

const ROLE_OPTIONS = [
  { value: "student", label: "Alunos" },
  { value: "teacher", label: "Professores" },
  { value: "manager", label: "Gestores" },
  { value: "admin", label: "Administradores" },
] as const;

const AUDIENCES: { value: Audience; label: string; hint: string; all: boolean }[] = [
  { value: "ALL", label: "Todos", hint: "Toda a plataforma", all: true },
  { value: "ROLE", label: "Perfil", hint: "Alunos, professores…", all: true },
  { value: "COURSE", label: "Curso", hint: "Turma de um curso", all: false },
  { value: "USER", label: "Pessoa", hint: "Um usuário", all: true },
];

export function AnnouncementComposer({ courses, canAll }: { courses: Course[]; canAll: boolean }) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>(canAll ? "ALL" : "COURSE");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [roleKey, setRoleKey] = useState<(typeof ROLE_OPTIONS)[number]["value"]>("student");
  const [target, setTarget] = useState<Target | null>(null);
  const [countResult, setCountResult] = useState<{ key: string; n: number | null; error?: string }>({ key: "", n: null });
  const { run, pending, fieldErrors, error } = useAction(sendAnnouncementAction, { errorToast: true });

  const payload = {
    title: title || "Prévia",
    body: body || "Prévia",
    audience,
    courseId: audience === "COURSE" ? courseId || null : null,
    roleKey: audience === "ROLE" ? roleKey : null,
    targetUserId: audience === "USER" ? (target?.id ?? null) : null,
  };
  const ready = audience === "ALL" || (audience === "ROLE" && !!roleKey) || (audience === "COURSE" && !!courseId) || (audience === "USER" && !!target);
  const payloadKey = JSON.stringify([audience, courseId, roleKey, target?.id]);

  // Prévia de alcance (mesmo cálculo do envio), com debounce.
  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const [aud, c, r, u] = JSON.parse(payloadKey) as [Audience, string, string, string | undefined];
      const res = await countAudienceAction({ title: "Prévia", body: "Prévia", audience: aud, courseId: aud === "COURSE" ? c : null, roleKey: aud === "ROLE" ? (r as never) : null, targetUserId: aud === "USER" ? (u ?? null) : null });
      if (cancelled) return;
      setCountResult(res.ok ? { key: payloadKey, n: res.data } : { key: payloadKey, n: null, error: res.error });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, ready, payloadKey]);
  const count = !ready
    ? { n: null, loading: false, error: undefined }
    : countResult.key === payloadKey
      ? { n: countResult.n, loading: false, error: countResult.error }
      : { n: null, loading: true, error: undefined };

  function reset() {
    setTitle("");
    setBody("");
    setTarget(null);
  }

  async function submit() {
    if (!ready) return;
    const n = count.n ?? 0;
    const ok = await confirm({
      title: "Enviar comunicado?",
      description:
        n > 0
          ? `${formatNumber(n)} ${n === 1 ? "pessoa receberá" : "pessoas receberão"} este comunicado na plataforma${canAll || audience === "COURSE" ? " (e por e-mail, conforme as preferências de cada um)" : ""}. Depois de enviado, não é possível desfazer.`
          : "Nenhuma pessoa será notificada com este público. Deseja publicar mesmo assim?",
      confirmLabel: "Enviar agora",
      tone: "primary",
    });
    if (!ok) return;
    const res = await run({ ...payload, title, body });
    if (res?.ok) {
      reset();
      setOpen(false);
    }
  }

  const available = AUDIENCES.filter((a) => canAll || !a.all);
  const noCourses = audience === "COURSE" && courses.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Megaphone /> Novo comunicado
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Novo comunicado"
        description="Os destinatários recebem uma notificação e encontram o texto completo em Comunicados."
        size="lg"
        footer={
          <>
            <div className="mr-auto flex items-center gap-2 text-small text-muted" aria-live="polite">
              <Users className="size-4 text-subtle" aria-hidden />
              {count.loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3.5" /> Calculando alcance…
                </span>
              ) : count.error ? (
                <span className="text-danger">{count.error}</span>
              ) : count.n !== null ? (
                <span>
                  Alcance: <strong className="font-semibold text-fg tabular-nums">{formatNumber(count.n)}</strong> {count.n === 1 ? "pessoa" : "pessoas"}
                </span>
              ) : (
                <span>Escolha o público</span>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={submit} loading={pending} disabled={!ready || noCourses || !title.trim() || !body.trim()}>
              Revisar e enviar
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-1.5 text-small font-medium text-fg">Público</legend>
            {available.length > 1 ? (
              <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {available.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    role="radio"
                    aria-checked={audience === a.value}
                    onClick={() => setAudience(a.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      audience === a.value ? "border-primary bg-primary-soft/50 ring-1 ring-primary" : "border-border-strong hover:bg-surface-2",
                    )}
                  >
                    <span className="block text-sm font-medium text-fg">{a.label}</span>
                    <span className="block text-caption text-muted">{a.hint}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-small text-muted">Você pode enviar comunicados para as turmas dos seus cursos.</p>
            )}
          </fieldset>

          {audience === "COURSE" &&
            (noCourses ? (
              <p className="rounded-lg border border-dashed border-border-strong px-4 py-3 text-small text-muted">Você ainda não tem cursos com turma para receber comunicados.</p>
            ) : (
              <Field label="Curso" error={fieldErrors.courseId} required>
                <NativeSelect value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · {c.students} {c.students === 1 ? "aluno" : "alunos"}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ))}
          {audience === "ROLE" && (
            <Field label="Perfil" error={fieldErrors.roleKey} required>
              <NativeSelect value={roleKey} onChange={(e) => setRoleKey(e.target.value as typeof roleKey)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {audience === "USER" && <TargetPicker value={target} onChange={setTarget} error={fieldErrors.targetUserId} />}

          <Field label="Título" error={fieldErrors.title} required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Ex.: Aula ao vivo nesta quinta às 20h" />
          </Field>
          <Field label="Mensagem" error={fieldErrors.body} required hint="Aceita Markdown. Use Visualizar para conferir antes de enviar.">
            <MarkdownEditor value={body} onChange={setBody} rows={7} maxLength={5000} invalid={!!fieldErrors.body} placeholder="Escreva o comunicado…" />
          </Field>
          {error && !Object.keys(fieldErrors).length && <p className="text-small font-medium text-danger">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TargetPicker({ value, onChange, error }: { value: Target | null; onChange: (t: Target | null) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; items: Target[] }>({ q: "", items: [] });
  const term = q.trim();
  const searching = term.length >= 2;
  const loading = searching && found.q !== term;
  const results = searching && found.q === term ? found.items : [];

  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchTargetsAction(term);
      if (!cancelled) setFound({ q: term, items: res.ok ? res.data : [] });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, searching]);

  if (value) {
    return (
      <div>
        <p className="mb-1.5 text-small font-medium text-fg">Destinatário</p>
        <div className="flex items-center gap-3 rounded-lg border border-border-strong px-3 py-2">
          <Avatar name={value.name} src={value.avatarUrl} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{value.name}</span>
            <span className="block truncate text-caption text-muted">{value.email}</span>
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label="Trocar destinatário">
            <X />
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Field label="Destinatário" error={error} required hint="Digite ao menos 2 letras do nome ou e-mail.">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa" className="pl-9" aria-label="Buscar destinatário" />
        {loading && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-subtle" />}
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
            {results.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onChange(r)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2">
                  <Avatar name={r.name} src={r.avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                    <span className="block truncate text-caption text-muted">{r.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
