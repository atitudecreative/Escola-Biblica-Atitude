import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca: livro aberto estilizado — duas páginas que formam um "A" ascendente. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M16 9.5 8 23h3.2L16 14.6 20.8 23H24L16 9.5Z" fill="var(--primary-fg)" />
      <path d="M11.8 19.4h8.4" stroke="var(--brand-accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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
        // eslint-disable-next-line @next/next/no-img-element -- logo configurável pelo CMS
        <img src={logoUrl} alt="" className="h-8 w-auto" />
      ) : (
        <LogoMark />
      )}
      {!compact && (
        <span className="text-[0.9375rem] leading-tight font-semibold tracking-tight text-fg">{name}</span>
      )}
    </Link>
  );
}
