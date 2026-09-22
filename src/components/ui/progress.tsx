import { cn, clamp } from "@/lib/utils";

export function Progress({
  value,
  className,
  tone = "primary",
  size = "md",
  label,
}: {
  value: number;
  className?: string;
  tone?: "primary" | "success" | "accent";
  size?: "sm" | "md";
  label?: string;
}) {
  const v = clamp(Math.round(value), 0, 100);
  const bar = { primary: "bg-primary", success: "bg-success", accent: "bg-accent" }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progresso"}
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", size === "sm" ? "h-1" : "h-1.5", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  className,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const v = clamp(value, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-caption font-semibold tabular-nums">
        {children ?? `${Math.round(v)}%`}
      </span>
    </div>
  );
}
