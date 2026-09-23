"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MessagesError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h2 className="mt-4 text-h4 text-fg">Não foi possível carregar as mensagens</h2>
      <p className="mt-1 max-w-sm text-small text-muted">Verifique sua conexão e tente novamente.</p>
      <Button variant="outline" size="sm" className="mt-5" onClick={() => retry()}>
        Tentar novamente
      </Button>
    </div>
  );
}
