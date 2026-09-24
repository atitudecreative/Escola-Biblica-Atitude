"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, BookOpen, Compass, Home, LogIn, Menu, MessageSquare, Search, Settings, User } from "lucide-react";
import { Logo } from "@/components/brand";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarNav, isActive, type NavCounts } from "./sidebar";
import { SIDEBAR_COOKIE, type NavItem, type NavSection } from "./nav-config";
import { CommandSearch } from "./command-search";
import { NotificationsPopover } from "./notifications-popover";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export type ShellUser = { name: string; email: string; avatarUrl: string | null; roleLabel: string };


const lgQuery = "(min-width: 1024px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(lgQuery);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(lgQuery).matches,
    () => true,
  );
}

/**
 * Shell único da plataforma (visitante e logado): sidebar recolhível no desktop,
 * trilho de ícones no tablet, gaveta + barra inferior no celular.
 * `bare` entrega o conteúdo sem o container padrão (páginas públicas controlam o próprio layout).
 */
export function AppShell({
  children,
  sections,
  footerItems = [],
  counts,
  user,
  brand,
  banner,
  initialCollapsed = false,
  bare = false,
}: {
  children: React.ReactNode;
  sections: NavSection[];
  footerItems?: NavItem[];
  counts: NavCounts;
  user: ShellUser | null;
  brand: { name: string; logoUrl: string | null };
  banner?: React.ReactNode;
  initialCollapsed?: boolean;
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const isDesktop = useIsDesktop();

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        const t = e.target as HTMLElement | null;
        if (t?.closest("input, textarea, [contenteditable=true]")) return;
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const rail = !isDesktop || collapsed;

  return (
    <div className="app-shell min-h-dvh" data-collapsed={collapsed}>
      <Sidebar
        brand={brand}
        sections={sections}
        counts={counts}
        footer={user ? <SidebarUser user={user} /> : <SidebarGuest />}
        rail={rail}
        canToggle
        collapsed={collapsed}
        onToggle={toggle}
      />

      {/* Gaveta (celular): navegação completa com rótulos */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="left" title="Menu" hideHeader className="w-[84vw] max-w-[300px]">
          <div className="flex h-15 items-center px-5">
            <Logo name={brand.name} logoUrl={brand.logoUrl} />
          </div>
          <SidebarNav sections={sections} counts={counts} onNavigate={() => setOpen(false)} />
          {user ? (
            footerItems.length > 0 && <SidebarNav sections={[{ title: "Conta", items: footerItems }]} counts={counts} onNavigate={() => setOpen(false)} />
          ) : (
            <div className="flex flex-col gap-2 border-t border-border p-4">
              <Button asChild size="lg">
                <Link href="/register" onClick={() => setOpen(false)}>Criar conta gratuita</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login" onClick={() => setOpen(false)}>Entrar</Link>
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <div className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-300 ease-[var(--ease-out-soft)] md:pl-(--sb)">
        <header className="sticky top-0 z-40 flex h-15 items-center gap-2 border-b border-border bg-bg/85 px-3 backdrop-blur-md sm:px-5 lg:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <div className="md:hidden">
            <Logo name={brand.name} logoUrl={brand.logoUrl} compact />
          </div>
          <div className="hidden flex-1 md:flex">{user ? <CommandSearch /> : <CatalogSearch />}</div>
          <div className="ml-auto flex items-center gap-1">
            <div className="md:hidden">{user ? <CommandSearch variant="icon" /> : <CatalogSearch compact />}</div>
            <ThemeToggle />
            {user ? (
              <>
                <NotificationsPopover unread={counts.notifications} />
                <div className="ml-1.5">
                  <UserMenu user={user} />
                </div>
              </>
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
          </div>
        </header>
        {banner}
        {bare ? (
          <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
        ) : (
          <main id="conteudo" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
            {children}
          </main>
        )}
      </div>
      <MobileTabBar loggedIn={!!user} unreadMessages={counts.messages} />
    </div>
  );
}

function SidebarUser({ user }: { user: ShellUser }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <Link
        href="/profile"
        aria-label={`${user.name} — meu perfil`}
        className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-[9px] whitespace-nowrap outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar name={user.name} src={user.avatarUrl} size="sm" className="shrink-0" />
        <span className="sb-label min-w-0">
          <span className="block truncate text-sm font-medium text-fg">{user.name}</span>
          <span className="block truncate text-caption text-subtle">{user.roleLabel}</span>
        </span>
      </Link>
      <Link
        href="/profile/settings"
        aria-label="Configurações"
        className="sb-only-full shrink-0 rounded-lg p-2.5 text-subtle outline-none transition-[color,background-color,rotate] duration-300 hover:rotate-45 hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Settings className="size-[18px]" aria-hidden />
      </Link>
    </div>
  );
}

function SidebarGuest() {
  return (
    <div className="mb-2">
      <div className="sb-only-full flex-col rounded-lg bg-surface-2 p-3">
        <p className="text-sm font-medium whitespace-nowrap text-fg">Estude com a gente</p>
        <p className="mt-0.5 text-caption text-muted">Crie sua conta e acompanhe seu progresso.</p>
        <Button asChild size="sm" className="mt-3 w-full">
          <Link href="/register">Criar conta gratuita</Link>
        </Button>
      </div>
      <Link
        href="/login"
        aria-label="Entrar"
        className="sb-only-rail mx-auto size-10 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <LogIn className="size-[18px]" aria-hidden />
      </Link>
    </div>
  );
}

/** Busca do visitante: vai para o catálogo público (a busca global exige login). */
function CatalogSearch({ compact }: { compact?: boolean }) {
  const router = useRouter();
  if (compact) {
    return (
      <Button asChild variant="ghost" size="icon" aria-label="Buscar cursos">
        <Link href="/courses">
          <Search />
        </Link>
      </Button>
    );
  }
  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q")?.toString().trim();
        router.push(q ? `/courses?q=${encodeURIComponent(q)}` : "/courses");
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        name="q"
        type="search"
        placeholder="Buscar cursos, temas, professores…"
        aria-label="Buscar cursos"
        className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm text-fg placeholder:text-subtle outline-none transition-[border-color,box-shadow] hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-ring/30"
      />
    </form>
  );
}

/** Navegação por toque (celular). */
function MobileTabBar({ loggedIn, unreadMessages }: { loggedIn: boolean; unreadMessages: number }) {
  const pathname = usePathname();
  const tabs = loggedIn
    ? [
        { href: "/", label: "Início", icon: Home, exact: true },
        { href: "/my-courses", label: "Meus cursos", icon: BookOpen },
        { href: "/courses", label: "Explorar", icon: Compass },
        { href: "/messages", label: "Mensagens", icon: MessageSquare, badge: unreadMessages },
        { href: "/profile", label: "Perfil", icon: User },
      ]
    : [
        { href: "/", label: "Início", icon: Home, exact: true },
        { href: "/courses", label: "Catálogo", icon: Compass },
        { href: "/certificate", label: "Certificado", icon: BadgeCheck },
        { href: "/login", label: "Entrar", icon: LogIn },
      ];
  return (
    <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className={cn("grid", loggedIn ? "grid-cols-5" : "grid-cols-4")}>
        {tabs.map((t) => {
          const active = isActive(pathname, t);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors",
                  active ? "text-primary" : "text-subtle",
                )}
              >
                <span className={cn("absolute top-0 h-0.5 w-8 rounded-b-full bg-primary transition-transform duration-300", active ? "scale-x-100" : "scale-x-0")} aria-hidden />
                <t.icon className={cn("size-5", active && "fill-primary/15")} aria-hidden />
                {t.label}
                {!!("badge" in t && t.badge) && <span className="absolute top-2 left-1/2 ml-2 size-2 rounded-full bg-danger" aria-label="Mensagens não lidas" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
