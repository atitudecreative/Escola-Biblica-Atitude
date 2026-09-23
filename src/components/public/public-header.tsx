"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/courses", label: "Cursos" },
  { href: "/#categorias", label: "Categorias" },
  { href: "/#professores", label: "Professores" },
  { href: "/certificate", label: "Validar certificado" },
];

export function PublicHeader({
  brand,
  user,
}: {
  brand: { name: string; logoUrl: string | null };
  user: { name: string; avatarUrl: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo name={brand.name} logoUrl={brand.logoUrl} />
        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg",
                pathname === l.href && "text-fg",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm font-medium transition hover:bg-surface-2">
              <span className="hidden sm:inline">Meu painel</span>
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            </Link>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/register">Criar conta</Link>
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
        </div>
      </div>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" title="Menu">
          <nav className="flex flex-col p-3">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-[0.9375rem] font-medium hover:bg-surface-2">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 border-t border-border p-4">
            {user ? (
              <Button asChild size="lg">
                <Link href="/dashboard">Ir para meu painel</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/register">Criar conta gratuita</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Entrar</Link>
                </Button>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </header>
  );
}
