"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { recordWatchAction } from "@/app/learn/actions";
import { SEGMENT_SECONDS, seekLimit, watchCoverage } from "@/lib/watch";

/**
 * Mede quanto do vídeo foi realmente assistido, em trechos de 5s.
 * Só conta reprodução contínua (saltos na barra não cobrem trechos) e envia
 * o que foi coberto ao servidor a cada ~10s — quem decide a conclusão é o servidor.
 */
export function useWatchTracker({
  lessonId,
  enabled,
  initialSegments,
  fallbackDuration,
  measurable,
  onServerComplete,
}: {
  lessonId: string;
  enabled: boolean;
  initialSegments: number[];
  fallbackDuration: number;
  /** O player sempre informa a duração (upload, link direto, YouTube, Vimeo). */
  measurable: boolean;
  onServerComplete: (courseCompleted: boolean) => void;
}) {
  const covered = useRef(new Set(initialSegments));
  const pending = useRef(new Set<number>());
  const played = useRef(new Map<number, number>());
  const last = useRef<number | null>(null);
  const position = useRef(0);
  const duration = useRef(fallbackDuration);
  const sending = useRef(false);
  // null = duração desconhecida (não há como medir; a conclusão fica manual).
  const [coverage, setCoverage] = useState<number | null>(() =>
    fallbackDuration > 0 ? watchCoverage(initialSegments, fallbackDuration) : measurable ? 0 : null,
  );

  /** Chamado pelo player a cada atualização de tempo. */
  const tick = useCallback((t: number, playing: boolean, dur?: number) => {
    if (dur && Number.isFinite(dur) && dur > 0) duration.current = dur;
    position.current = t;
    const prev = last.current;
    last.current = t;
    if (!playing || prev == null) return;
    const d = t - prev;
    if (d <= 0 || d > 3) return; // pausa, volta ou salto: não conta
    let a = prev;
    while (a < t) {
      const seg = Math.floor(a / SEGMENT_SECONDS);
      const b = Math.min(t, (seg + 1) * SEGMENT_SECONDS);
      const acc = (played.current.get(seg) ?? 0) + (b - a);
      played.current.set(seg, acc);
      const segLen = duration.current > 0 ? Math.min(SEGMENT_SECONDS, duration.current - seg * SEGMENT_SECONDS) : SEGMENT_SECONDS;
      if (!covered.current.has(seg) && acc >= Math.max(0.5, segLen * 0.8)) {
        covered.current.add(seg);
        pending.current.add(seg);
      }
      a = b;
    }
  }, []);

  const flush = useCallback(async () => {
    if (!enabled || sending.current || (!pending.current.size && position.current === 0)) return;
    const segments = [...pending.current];
    pending.current.clear();
    sending.current = true;
    const res = await recordWatchAction({ lessonId, segments, position: position.current, duration: duration.current }).catch(() => null);
    sending.current = false;
    if (!res?.ok) {
      segments.forEach((s) => pending.current.add(s)); // tenta de novo no próximo envio
      return;
    }
    if (!res.data) return;
    if (res.data.coverage !== null) setCoverage(res.data.coverage);
    if (res.data.completed) onServerComplete(res.data.courseCompleted);
  }, [enabled, lessonId, onServerComplete]);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => void flush(), 10_000);
    const onHide = () => document.visibilityState === "hidden" && void flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [enabled, flush]);

  /** Limita a busca na barra ao que já foi assistido. */
  const clampSeek = useCallback((to: number) => Math.min(to, seekLimit(covered.current)), []);
  /** Cobertura local (inclui o que ainda não foi enviado), para a interface. */
  const localCoverage = useCallback(() => (duration.current > 0 ? watchCoverage(covered.current, duration.current) : 0), []);

  return { tick, flush, clampSeek, coverage, localCoverage };
}
