import * as React from "react";
import { cn, hashString, initials } from "@/lib/utils";

const sizes = { xs: "size-6 text-[0.625rem]", sm: "size-8 text-[0.6875rem]", md: "size-10 text-small", lg: "size-14 text-h4", xl: "size-20 text-h2" };
// Paleta de fundos neutros-quentes para iniciais (sem neon, legível nos dois temas).
const hues = [155, 35, 200, 12, 265, 95, 330, 180];

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const hue = hues[hashString(name) % hues.length];
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none", sizes[size], className)}
      style={src ? undefined : { background: `oklch(0.9 0.04 ${hue})`, color: `oklch(0.38 0.07 ${hue})` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatares vêm do storage autenticado; sem otimização remota
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = "sm" }: { people: { name: string; avatarUrl?: string | null }[]; max?: number; size?: keyof typeof sizes }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} src={p.avatarUrl} size={size} className="ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span className={cn("inline-flex items-center justify-center rounded-full bg-surface-3 font-medium text-muted ring-2 ring-surface", sizes[size])}>
          +{rest}
        </span>
      )}
    </div>
  );
}
