"use client";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Estrutura em dois painéis. No desktop/tablet: lista + conversa lado a lado,
 * com altura da janela. No celular: telas separadas — a lista quando nenhuma
 * conversa está aberta; a conversa em tela cheia (acima da barra inferior)
 * com botão de voltar.
 */
export function MessagesShell({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const open = !!useSelectedLayoutSegment();
  return (
    <div
      className={cn(
        "md:-mb-18 md:grid md:h-[calc(100dvh-60px-3rem)] md:grid-cols-[300px_minmax(0,1fr)] md:overflow-hidden md:rounded-xl md:border md:border-border md:bg-surface md:shadow-xs",
        "lg:-mb-4 lg:h-[calc(100dvh-60px-4rem)] lg:grid-cols-[340px_minmax(0,1fr)]",
      )}
    >
      <aside className={cn("flex min-h-0 flex-col md:border-r md:border-border", open && "hidden md:flex")}>{list}</aside>
      <section
        className={cn(
          "min-h-0 min-w-0 flex-col bg-bg md:flex",
          open
            ? "fixed inset-x-0 top-15 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex md:static md:inset-auto md:z-auto"
            : "hidden",
        )}
      >
        {children}
      </section>
    </div>
  );
}
