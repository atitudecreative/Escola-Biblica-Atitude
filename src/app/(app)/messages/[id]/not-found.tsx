import Link from "next/link";
import { MessageSquareOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted">
        <MessageSquareOff className="size-5" aria-hidden />
      </div>
      <h2 className="mt-4 text-h4 text-fg">Conversa não encontrada</h2>
      <p className="mt-1 max-w-sm text-small text-muted">Ela pode ter sido removida ou você não participa dela.</p>
      <Button asChild variant="outline" size="sm" className="mt-5">
        <Link href="/messages">Voltar para mensagens</Link>
      </Button>
    </div>
  );
}
