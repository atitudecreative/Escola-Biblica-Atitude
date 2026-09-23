import { formatDistanceToNowStrict, format as fmt } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(d: Date | string | null | undefined, pattern = "d 'de' MMM 'de' yyyy") {
  if (!d) return "—";
  return fmt(new Date(d), pattern, { locale: ptBR });
}

export function formatDateTime(d: Date | string | null | undefined) {
  return formatDate(d, "dd/MM/yyyy 'às' HH:mm");
}

export function formatShortDate(d: Date | string | null | undefined) {
  return formatDate(d, "dd/MM/yyyy");
}

export function timeAgo(d: Date | string | null | undefined) {
  if (!d) return "nunca";
  const date = new Date(d);
  if (Date.now() - date.getTime() < 60_000) return "agora";
  return `há ${formatDistanceToNowStrict(date, { locale: ptBR })}`;
}

/** 5400 → "1h 30min" */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

/** 95 → "01:35" / "1:02:03" */
export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

export function formatNumber(n: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(n);
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatPercent(n: number, digits = 0) {
  return `${formatNumber(n, digits)}%`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${formatNumber(v, v < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatMoney(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function pluralize(n: number, one: string, many: string) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
