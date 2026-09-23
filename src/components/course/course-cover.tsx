import { cn, hashString } from "@/lib/utils";

/**
 * Capa de curso. Usa a imagem enviada pelo professor; na ausência dela,
 * gera uma arte tipográfica determinística a partir do título — sempre
 * dentro da paleta da marca, sem depender de imagens externas.
 */
const PALETTES = [
  { bg: "#1f4a3f", fg: "#f3efe4", accent: "#c9a15a" },
  { bg: "#27313f", fg: "#eef0f3", accent: "#8fb3d9" },
  { bg: "#3b2d25", fg: "#f4ede4", accent: "#d69a5c" },
  { bg: "#2d2a3c", fg: "#efedf5", accent: "#b7a4e0" },
  { bg: "#2f3b2a", fg: "#eff2e8", accent: "#b9c97a" },
  { bg: "#3a2530", fg: "#f5ecef", accent: "#e39cb4" },
  { bg: "#233838", fg: "#e9f2f1", accent: "#7ec3bb" },
  { bg: "#403421", fg: "#f6f0e2", accent: "#e2bd6b" },
];

export function CourseCover({
  title,
  category,
  src,
  className,
  size = "md",
  tone,
}: {
  title: string;
  category?: string | null;
  /** Índice de paleta (ex.: posição da categoria) — cursos da mesma área compartilham cor. */
  tone?: number | null;
  src?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (src) {
    return (
      <div className={cn("relative aspect-[16/9] overflow-hidden bg-surface-3", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- capas vêm do storage próprio */}
        <img src={src} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
      </div>
    );
  }
  const h = hashString(title);
  const p = PALETTES[(tone ?? h) % PALETTES.length];
  const variant = (h >> 4) % 3;
  const words = title.split(" ");
  // Tipografia proporcional à largura da capa (container queries): nunca estoura o quadro.
  const titleSize = { sm: "clamp(0.8rem, 8cqw, 1.5rem)", md: "clamp(0.95rem, 7.4cqw, 2.1rem)", lg: "clamp(1.25rem, 6.6cqw, 2.6rem)" }[size];
  return (
    <div className={cn("relative aspect-[16/9] overflow-hidden [container-type:inline-size]", className)} style={{ background: p.bg, color: p.fg }} aria-hidden>
      <svg className="absolute inset-0 size-full" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        {variant === 0 &&
          Array.from({ length: 7 }).map((_, i) => (
            <circle key={i} cx={290} cy={20} r={24 + i * 22} fill="none" stroke={p.accent} strokeOpacity={0.28 - i * 0.035} />
          ))}
        {variant === 1 &&
          Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={180 + i * 18} y1={0} x2={120 + i * 18} y2={180} stroke={p.accent} strokeOpacity={0.16} strokeWidth={1} />
          ))}
        {variant === 2 && (
          <>
            <rect x={214} y={-30} width={140} height={140} rx={70} fill={p.accent} fillOpacity={0.14} />
            <rect x={250} y={60} width={100} height={100} rx={50} fill={p.accent} fillOpacity={0.1} />
          </>
        )}
        <rect x={0} y={0} width={4} height={180} fill={p.accent} fillOpacity={0.9} />
      </svg>
      <div className="absolute inset-0 flex flex-col justify-end p-[7%]">
        {category && size !== "sm" && (
          <span className="mb-[2.5cqw] text-[clamp(0.55rem,2.6cqw,0.75rem)] font-semibold tracking-[0.14em] uppercase" style={{ color: p.accent }}>
            {category}
          </span>
        )}
        <span className="line-clamp-3 max-w-[88%] font-display leading-[1.08] tracking-tight text-balance" style={{ fontSize: titleSize }}>
          {words.length > 9 ? words.slice(0, 9).join(" ") + "…" : title}
        </span>
      </div>
    </div>
  );
}
