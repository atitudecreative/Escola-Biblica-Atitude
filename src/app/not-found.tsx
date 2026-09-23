import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted"><Compass className="size-6" /></span>
      <p className="mt-6 text-overline text-subtle">Erro 404</p>
      <h1 className="mt-2 font-display text-[2.25rem] leading-tight tracking-tight">Página não encontrada</h1>
      <p className="mt-3 max-w-md text-muted">O endereço pode ter mudado ou o conteúdo não está mais disponível.</p>
      <div className="mt-8 flex gap-2">
        <Button asChild><Link href="/">Ir para o início</Link></Button>
        <Button asChild variant="outline"><Link href="/courses">Ver cursos</Link></Button>
      </div>
    </main>
  );
}
