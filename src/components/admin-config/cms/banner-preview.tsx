import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerDraft = {
  placement: "HOME_HERO" | "DASHBOARD";
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
};

/** Miniatura fiel do banner como aparece na home (hero) ou no painel do aluno. */
export function BannerPreview({ b, className }: { b: BannerDraft; className?: string }) {
  const img = !!b.imageUrl;
  const compact = b.placement === "DASHBOARD";
  // Home com imagem: igual ao site — só a arte, na proporção 3:1, sem texto por cima.
  if (img && !compact) {
    return (
      <div className={cn("overflow-hidden rounded-xl border border-border bg-surface-3", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização do upload */}
        <img src={b.imageUrl} alt="" className="aspect-[3/1] w-full object-cover" />
        <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-caption text-muted">
          <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{b.ctaHref ? `Ao clicar: ${b.ctaHref}` : "Sem link: a imagem não será clicável"}</span>
        </p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl border border-border",
        img ? "bg-black text-white" : "bg-surface",
        compact ? "min-h-36" : "min-h-56",
        className,
      )}
    >
      {img ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização do upload */}
          <img src={b.imageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,var(--primary-soft),transparent_60%)]" />
      )}
      <div className={cn("flex h-full flex-col justify-center", compact ? "p-5" : "p-6 sm:p-8")}>
        {b.eyebrow && (
          <p className={cn("mb-3 inline-flex items-center gap-2 text-overline", img ? "text-white/80" : "text-primary")}>
            <span className="h-px w-5 bg-current" aria-hidden />
            {b.eyebrow}
          </p>
        )}
        <p className={cn("font-display tracking-tight text-balance", compact ? "text-h3" : "text-[1.625rem] leading-[1.15] sm:text-[1.875rem]")}>
          {b.title || <span className="opacity-40">Título do banner</span>}
        </p>
        {b.subtitle && (
          <p className={cn("mt-2 max-w-md text-small leading-relaxed", img ? "text-white/85" : "text-muted")}>{b.subtitle}</p>
        )}
        {b.ctaLabel && (
          <span className="mt-4 inline-flex h-9 w-fit items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-fg">
            {b.ctaLabel} <ArrowRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
