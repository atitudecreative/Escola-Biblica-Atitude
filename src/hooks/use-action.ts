"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action";

/**
 * Executa uma Server Action com estado de carregamento, erros de campo e
 * feedback (toast). Retorna o resultado para a tela reagir.
 */
export function useAction<I, O>(
  action: (input: I) => Promise<ActionResult<O>>,
  opts: { successToast?: boolean; errorToast?: boolean; onSuccess?: (data: O) => void } = {},
) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function run(input: I) {
    return new Promise<ActionResult<O> | undefined>((resolve) => {
      startTransition(async () => {
        setError(null);
        setFieldErrors({});
        try {
          const res = await action(input);
          if (!res) return resolve(undefined); // redirecionou
          if (res.ok) {
            if (opts.successToast !== false && res.message) toast.success(res.message);
            opts.onSuccess?.(res.data);
          } else {
            setError(res.error);
            setFieldErrors(res.fieldErrors ?? {});
            if (opts.errorToast) toast.error(res.error);
          }
          resolve(res);
        } catch (e) {
          // Erros de navegação (redirect) são relançados pelo Next e não chegam aqui.
          const msg = "Não foi possível completar a ação. Verifique sua conexão e tente novamente.";
          setError(msg);
          if (opts.errorToast) toast.error(msg);
          resolve({ ok: false, error: msg });
          if (process.env.NODE_ENV !== "production") console.error(e);
        }
      });
    });
  }

  return { run, pending, error, fieldErrors, setFieldErrors, setError };
}
