"use client";
import { formatDateTime, timeAgo } from "@/lib/format";

/**
 * Tempo relativo ("há 5 minutos"). O texto pode divergir entre servidor e
 * cliente na virada do minuto — suprimimos esse aviso apenas neste nó.
 */
export function RelativeTime({ date, className }: { date: Date | string; className?: string }) {
  const d = new Date(date);
  return (
    <time dateTime={d.toISOString()} title={formatDateTime(d)} className={className} suppressHydrationWarning>
      {timeAgo(d)}
    </time>
  );
}
