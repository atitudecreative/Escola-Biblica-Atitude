"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Erro inesperado de renderização: mensagem amigável + tentar de novo. Detalhes vão ao console/log. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="conteudo" className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertTriangle className="size-6" /></span>
      <h1 className="mt-6 text-h1">Algo deu errado</h1>
      <p className="mt-2 max-w-md text-muted">Não conseguimos carregar esta página. Tente novamente em instantes.</p>
      {error.digest && <p className="mt-2 font-mono text-caption text-subtle">Código: {error.digest}</p>}
      <Button className="mt-8" onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
