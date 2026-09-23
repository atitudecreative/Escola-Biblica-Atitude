"use client";
import * as React from "react";
import { AlertDialog as A } from "radix-ui";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
const Ctx = React.createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Provedor global de confirmações. Use `const confirm = useConfirm()` e `await confirm({...})`. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const confirm = React.useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })),
    [],
  );
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <A.Root open={!!pending} onOpenChange={(o) => !o && close(false)}>
        <A.Portal>
          <A.Overlay className="fixed inset-0 z-[60] bg-overlay data-[state=open]:animate-fade-in" />
          <A.Content
            className={cn(
              "fixed top-1/2 left-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-lg outline-none data-[state=open]:animate-scale-in",
            )}
          >
            <A.Title className="text-h3">{pending?.title}</A.Title>
            <A.Description className="mt-2 text-sm text-muted">{pending?.description ?? "Esta ação não pode ser desfeita."}</A.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <A.Cancel asChild>
                <Button variant="outline">{pending?.cancelLabel ?? "Cancelar"}</Button>
              </A.Cancel>
              <A.Action asChild>
                <Button variant={pending?.tone === "primary" ? "primary" : "danger"} onClick={() => close(true)}>
                  {pending?.confirmLabel ?? "Confirmar"}
                </Button>
              </A.Action>
            </div>
          </A.Content>
        </A.Portal>
      </A.Root>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>");
  return ctx;
}
