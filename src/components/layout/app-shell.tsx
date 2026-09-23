"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Home, Menu, MessageSquare, User } from "lucide-react";
import { Logo } from "@/components/brand";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SidebarNav, type NavCounts } from "./sidebar";
import type { NavSection } from "./nav-config";
import { CommandSearch } from "./command-search";
import { NotificationsPopover } from "./notifications-popover";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export type ShellUser = { name: string; email: string; avatarUrl: string | null; roleLabel: string };

export function AppShell({
  children,
  sections,
  counts,
  user,
  brand,
  banner,
}: {
  children: React.ReactNode;
  sections: NavSection[];
  counts: NavCounts;
  user: ShellUser;
  brand: { name: string; logoUrl: string | null };
  banner?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-15 shrink-0 items-center px-5">
          <Logo name={brand.name} logoUrl={brand.logoUrl} href="/dashboard" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav sections={sections} counts={counts} />
        </div>
      </aside>

      {/* Drawer mobile/tablet */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="left" title="Menu" hideHeader className="w-[84vw] max-w-[300px]">
          <div className="flex h-15 items-center px-5">
            <Logo name={brand.name} logoUrl={brand.logoUrl} href="/dashboard" />
          </div>
          <SidebarNav sections={sections} counts={counts} onNavigate={() => setOpen(false)} />
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-15 items-center gap-2 border-b border-border bg-surface/85 px-3 backdrop-blur-md sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <div className="lg:hidden">
            <Logo name={brand.name} logoUrl={brand.logoUrl} href="/dashboard" compact />
          </div>
          <div className="hidden flex-1 md:flex">
            <CommandSearch />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="md:hidden">
              <CommandSearch variant="icon" />
            </div>
            <ThemeToggle />
            <NotificationsPopover unread={counts.notifications} />
            <div className="ml-1.5">
              <UserMenu user={user} />
            </div>
          </div>
        </header>
        {banner}
        <main id="conteudo" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileTabBar unreadMessages={counts.messages} />
    </div>
  );
}

/** Navegação simplificada por toque (celular). */
function MobileTabBar({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard", label: "Início", icon: Home },
    { href: "/my-courses", label: "Cursos", icon: BookOpen },
    { href: "/courses", label: "Explorar", icon: Compass },
    { href: "/messages", label: "Mensagens", icon: MessageSquare, badge: unreadMessages },
    { href: "/profile", label: "Perfil", icon: User },
  ];
  return (
    <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium", active ? "text-primary" : "text-subtle")}>
                <t.icon className="size-5" />
                {t.label}
                {!!t.badge && <span className="absolute top-2 left-1/2 ml-2 size-2 rounded-full bg-danger" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
