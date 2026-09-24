import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { CourseCover } from "@/components/course/course-cover";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/icon";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cabeçalho de seção da Home: sobretítulo editorial + título + ação opcional. */
export function HomeSection({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("scroll-mt-20", className)} id={id}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="text-overline text-primary">{eyebrow}</p>}
          <h2 id={`${id}-title`} className="mt-1.5 text-h2 text-balance">
            {title}
          </h2>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {action && (
          <Link href={action.href} className="group hidden shrink-0 items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline sm:inline-flex">
            {action.label} <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export type ContinueItem = {
  id: string;
  progressPercent: number;
  course: { id: string; slug: string; title: string; coverUrl: string | null; category: { name: string; position: number } | null };
  lastLesson: { title: string; module: { title: string } } | null;
};

/** Retomar estudos: o primeiro curso ganha destaque; os demais ficam compactos ao lado. */
export function ContinueLearning({ items }: { items: ContinueItem[] }) {
  const [main, ...rest] = items;
  if (!main) return null;
  return (
    <div className={cn("grid grid-cols-1 gap-4", rest.length > 0 && "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]")}>
      <Link
        href={`/learn/${main.course.id}`}
        className="group relative flex min-w-0 flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-xs outline-none transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:p-5"
      >
        <div className="overflow-hidden rounded-xl sm:w-56 sm:shrink-0">
          <CourseCover title={main.course.title} tone={main.course.category?.position} src={main.course.coverUrl} size="sm" className="transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-caption text-subtle">{main.lastLesson ? `${main.lastLesson.module.title}` : "Primeira aula"}</p>
          <p className="mt-1 line-clamp-2 text-h3">{main.course.title}</p>
          <p className="mt-1 truncate text-small text-muted">{main.lastLesson ? `Próxima: ${main.lastLesson.title}` : "Comece pela primeira aula"}</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={main.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso no curso">
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${main.progressPercent}%` }} />
            </div>
            <span className="text-caption font-medium text-muted tabular-nums">{main.progressPercent}%</span>
          </div>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-fg transition-colors group-hover:bg-primary-hover">
          <Play className="size-4 fill-current transition-transform duration-200 group-hover:scale-110" aria-hidden /> Continuar
        </span>
      </Link>

      {rest.length > 0 && (
        <ul className="grid min-w-0 grid-cols-1 gap-3">
          {rest.map((e) => (
            <li key={e.id}>
              <Link
                href={`/learn/${e.course.id}`}
                className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-3 outline-none transition-[border-color,background-color] hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="w-24 shrink-0 overflow-hidden rounded-lg">
                  <CourseCover title={e.course.title} tone={e.course.category?.position} src={e.course.coverUrl} size="sm" showTitle={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold group-hover:text-primary">{e.course.title}</p>
                  <p className="mt-0.5 truncate text-caption text-subtle">{e.lastLesson ? e.lastLesson.title : "Comece pela primeira aula"}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${e.progressPercent}%` }} />
                  </div>
                </div>
                <span className="text-caption font-medium text-muted tabular-nums">{e.progressPercent}%</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Como funciona: o caminho real dentro da plataforma, do catálogo ao certificado. */
export function HowItWorks({ benefits, autoCertificate }: { benefits: { icon: string; title: string; text: string }[]; autoCertificate: boolean }) {
  const steps = [
    { title: "Escolha um curso", text: "Navegue por área ou busque um tema e inscreva-se em um clique." },
    { title: "Estude no seu ritmo", text: "Aulas, materiais e avaliações. O progresso fica salvo e você retoma de onde parou." },
    {
      title: "Receba o certificado",
      text: autoCertificate
        ? "Ao concluir, o certificado é emitido na hora, com código e QR Code para validação."
        : "Ao concluir, a secretaria libera seu certificado, com código e QR Code para validação.",
    },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <ol className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {steps.map((s, i) => (
          <li key={s.title} className="group relative p-6 lg:p-7">
            <span className="font-display text-[2.5rem] leading-none text-accent/80 tabular-nums transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="mt-4 text-h4">{s.title}</p>
            <p className="mt-1.5 text-small text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
      {benefits.length > 0 && (
        <ul className="grid gap-x-8 gap-y-5 border-t border-border bg-surface-2/60 p-6 sm:grid-cols-2 lg:grid-cols-4 lg:p-7">
          {benefits.slice(0, 4).map((b) => (
            <li key={b.title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-fg">
                <Icon name={b.icon} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{b.title}</span>
                <span className="mt-0.5 block text-small text-muted">{b.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeachersStrip({ teachers }: { teachers: { id: string; name: string; headline: string | null; avatarUrl: string | null; courses: number; students: number }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teachers.map((t) => (
        <li key={t.id}>
          <Link
            href={`/teachers/${t.id}`}
            className="group flex items-center gap-4 rounded-xl border border-transparent p-3 outline-none transition-[border-color,background-color] hover:border-border hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar name={t.name} src={t.avatarUrl} size="lg" className="transition-transform duration-300 group-hover:scale-105" />
            <div className="min-w-0">
              <p className="truncate text-h4 group-hover:text-primary">{t.name}</p>
              {t.headline && <p className="line-clamp-1 text-small text-muted">{t.headline}</p>}
              <p className="mt-0.5 text-caption text-subtle">
                {pluralize(t.courses, "curso", "cursos")} · {pluralize(t.students, "aluno", "alunos")}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Testimonials({ items }: { items: { name: string; role: string; quote: string }[] }) {
  return (
    <ul className="grid gap-x-10 gap-y-8 md:grid-cols-3">
      {items.slice(0, 3).map((t, i) => (
        <li key={i} className="border-l-2 border-accent/70 pl-5">
          <blockquote className="font-display text-[1.0625rem] leading-relaxed text-pretty text-fg">“{t.quote}”</blockquote>
          <p className="mt-4 text-small font-medium">{t.name}</p>
          <p className="text-caption text-subtle">{t.role}</p>
        </li>
      ))}
    </ul>
  );
}
