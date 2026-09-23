"use client";
import { useEffect, useRef } from "react";

/**
 * Executa `fn` a cada `ms` apenas com a aba visível, e imediatamente quando a
 * aba volta a ficar visível. Nunca sobrepõe execuções (espera a anterior).
 * Ponto único de troca: para SSE/WebSocket, substitua este hook por uma
 * assinatura que entregue os mesmos eventos.
 */
export function useVisibleInterval(fn: () => Promise<unknown> | void, ms: number, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    const tick = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        await ref.current();
      } catch {
        // falhas de rede no polling são silenciosas; a próxima tentativa recupera
      } finally {
        running = false;
      }
    };
    const id = window.setInterval(tick, ms);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}
