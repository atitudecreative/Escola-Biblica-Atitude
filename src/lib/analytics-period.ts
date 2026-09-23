/**
 * Períodos de análise (isomórfico: usado pelos serviços e pelo filtro na UI).
 *
 * Datas em UTC, alinhadas ao início do dia (a tabela user_activity_days é
 * agregada por dia UTC). `to` é EXCLUSIVO: [from, to).
 * O período anterior tem a mesma duração e termina onde o atual começa.
 */
export const PERIOD_KEYS = ["today", "7d", "30d", "90d", "custom", "all"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];
export type Bucket = "day" | "week" | "month";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  custom: "Personalizado",
  all: "Todo o período",
};

export type Period = {
  key: PeriodKey;
  /** null = sem limite inferior ("todo o período") */
  from: Date | null;
  to: Date;
  prevFrom: Date | null;
  prevTo: Date | null;
  days: number;
  bucket: Bucket;
  /** Valores para a URL (YYYY-MM-DD, `to` inclusivo) */
  fromISO: string | null;
  toISO: string;
};

const DAY = 86_400_000;
const MAX_CUSTOM_DAYS = 731;

export function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseIsoDay(s: string | undefined | null) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function bucketFor(days: number): Bucket {
  if (days <= 92) return "day";
  if (days <= 400) return "week";
  return "month";
}

type SP = Record<string, string | string[] | undefined>;

/**
 * Lê ?period=&from=&to= e devolve um período válido. Valores inválidos caem
 * no padrão — a URL é entrada do usuário.
 */
export function parsePeriod(sp: SP, opts: { fallback?: PeriodKey; allowAll?: boolean; now?: Date } = {}): Period {
  const fallback = opts.fallback ?? "30d";
  const raw = typeof sp.period === "string" ? sp.period : undefined;
  let key: PeriodKey = (PERIOD_KEYS as readonly string[]).includes(raw ?? "") ? (raw as PeriodKey) : fallback;
  if (key === "all" && !opts.allowAll) key = "30d";

  const today = startOfUtcDay(opts.now);
  const tomorrow = new Date(today.getTime() + DAY);

  if (key === "all") {
    return { key, from: null, to: tomorrow, prevFrom: null, prevTo: null, days: 0, bucket: "month", fromISO: null, toISO: isoDay(today) };
  }

  let from: Date;
  let to = tomorrow;
  if (key === "custom") {
    const f = parseIsoDay(typeof sp.from === "string" ? sp.from : null);
    const t = parseIsoDay(typeof sp.to === "string" ? sp.to : null);
    if (!f || !t) {
      return parsePeriod({ period: fallback === "custom" ? "30d" : fallback }, opts);
    }
    const [a, b] = f <= t ? [f, t] : [t, f];
    from = a;
    to = new Date(Math.min(b.getTime(), today.getTime()) + DAY);
    if (to <= from) to = new Date(from.getTime() + DAY);
    if ((to.getTime() - from.getTime()) / DAY > MAX_CUSTOM_DAYS) from = new Date(to.getTime() - MAX_CUSTOM_DAYS * DAY);
  } else {
    const n = key === "today" ? 1 : Number(key.replace("d", ""));
    from = new Date(tomorrow.getTime() - n * DAY);
  }
  const days = Math.round((to.getTime() - from.getTime()) / DAY);
  const prevTo = from;
  const prevFrom = new Date(from.getTime() - days * DAY);
  return {
    key,
    from,
    to,
    prevFrom,
    prevTo,
    days,
    bucket: bucketFor(days),
    fromISO: isoDay(from),
    toISO: isoDay(new Date(to.getTime() - DAY)),
  };
}

/** Querystring do período (para links de exportação/relatórios). */
export function periodQuery(p: Period): Record<string, string> {
  if (p.key === "custom" && p.fromISO) return { period: "custom", from: p.fromISO, to: p.toISO };
  return { period: p.key };
}

/** Variação percentual; null quando não há base de comparação. */
export function pctDelta(current: number, previous: number | null | undefined) {
  if (previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
