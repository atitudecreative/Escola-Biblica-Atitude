"use client";
import { useEffect, useState } from "react";

const SPOTS = [
  "top-[12%] left-[8%]",
  "top-[18%] right-[10%]",
  "top-[46%] left-[30%]",
  "bottom-[26%] right-[14%]",
  "bottom-[20%] left-[12%]",
];

/**
 * Marca d'água com a identificação do aluno sobre o vídeo, mudando de lugar.
 * Não impede gravar a tela (nada no navegador impede), mas torna qualquer vazamento rastreável.
 */
export function Watermark({ text }: { text: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SPOTS.length), 20_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-[5] max-w-[70%] truncate text-[11px] font-medium tracking-wide text-white/25 select-none sm:text-xs ${SPOTS[i]}`}
    >
      {text}
    </span>
  );
}
