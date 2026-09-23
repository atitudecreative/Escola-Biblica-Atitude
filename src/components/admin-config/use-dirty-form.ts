"use client";
import { useEffect, useMemo, useState } from "react";

/**
 * Estado de formulário com detecção de "alterações não salvas".
 * `commit` marca os valores atuais como salvos (após sucesso da action).
 */
export function useDirtyForm<T>(initial: T) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);

  // Avisa antes de sair da página com alterações pendentes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function set<K extends keyof T>(key: K, value: T[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  return {
    values,
    setValues,
    set,
    dirty,
    reset: () => setValues(saved),
    commit: (next?: T) => {
      const v = next ?? values;
      setSaved(v);
      setValues(v);
    },
  };
}
