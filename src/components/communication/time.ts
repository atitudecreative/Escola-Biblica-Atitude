/**
 * Datas da área de comunicação. Formatamos sempre no fuso da Escola
 * (America/Sao_Paulo) para que servidor e navegador gerem o mesmo texto
 * (evita divergência de hidratação) e "Hoje/Ontem" reflitam o dia local.
 */
const TZ = "America/Sao_Paulo";
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const clockFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const longDayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const longDayYearFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short" });
const shortFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "long", timeStyle: "short" });

type D = Date | string | number;
const toDate = (d: D) => (d instanceof Date ? d : new Date(d));
const DAY = 86_400_000;

export const dayKey = (d: D) => keyFmt.format(toDate(d));
export const clock = (d: D) => clockFmt.format(toDate(d));
export const fullDateTime = (d: D) => fullFmt.format(toDate(d));

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Hoje", "Ontem", "Segunda-feira, 14 de setembro" ou "14 de setembro de 2025". */
export function dayLabel(d: D, now: D = Date.now()) {
  const k = dayKey(d);
  const n = toDate(now).getTime();
  if (k === dayKey(n)) return "Hoje";
  if (k === dayKey(n - DAY)) return "Ontem";
  const date = toDate(d);
  if (n - date.getTime() < 180 * DAY) return capitalize(longDayFmt.format(date));
  return longDayYearFmt.format(date);
}

/** Carimbo compacto para listas: "14:32", "Ontem", "seg.", "12/08/25". */
export function listStamp(d: D, now: D = Date.now()) {
  const date = toDate(d);
  const n = toDate(now).getTime();
  const k = dayKey(date);
  if (k === dayKey(n)) return clock(date);
  if (k === dayKey(n - DAY)) return "Ontem";
  if (n - date.getTime() < 6 * DAY) return capitalize(weekdayFmt.format(date).replace(".", ""));
  return shortFmt.format(date);
}

/** "agora", "há 5 min", "há 3 h", depois data curta. */
export function relative(d: D, now: D = Date.now()) {
  const diff = toDate(now).getTime() - toDate(d).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
  if (diff < DAY) return `há ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return days === 1 ? "ontem" : `há ${days} dias`;
  }
  return shortFmt.format(toDate(d));
}
