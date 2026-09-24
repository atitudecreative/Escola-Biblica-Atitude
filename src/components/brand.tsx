import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Identidade da Escola Bíblica Atitude (arquivos em /public/brand):
 * logo completo (capelo + "eba" + nome) e o capelo sozinho para espaços pequenos.
 * Preto no tema claro, branco no escuro. Um logo enviado em Admin › Configurações tem prioridade.
 */

/** Capelo (marca reduzida): trilho da sidebar, topo no celular. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-7 shrink-0", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG estático pequeno */}
      <img src="/brand/mark-black.png" alt="" width={157} height={128} className="h-full w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG estático pequeno */}
      <img src="/brand/mark-white.png" alt="" width={157} height={128} className="hidden h-full w-auto dark:block" />
    </span>
  );
}

/** Logo completo (já contém o nome da Escola). */
export function LogoFull({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-11 shrink-0", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG estático */}
      <img src="/brand/logo-black.png" alt="" width={458} height={176} className="h-full w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG estático */}
      <img src="/brand/logo-white.png" alt="" width={458} height={176} className="hidden h-full w-auto dark:block" />
    </span>
  );
}

export function Logo({
  name,
  logoUrl,
  href = "/",
  className,
  compact,
}: {
  name: string;
  logoUrl?: string | null;
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 rounded-md", className)} aria-label={`${name} — início`}>
      {logoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo configurável pelo CMS */}
          <img src={logoUrl} alt="" className="h-8 w-auto" />
          {!compact && <span className="text-[0.9375rem] leading-tight font-semibold tracking-tight text-fg">{name}</span>}
        </>
      ) : compact ? (
        <LogoMark />
      ) : (
        <LogoFull />
      )}
    </Link>
  );
}
