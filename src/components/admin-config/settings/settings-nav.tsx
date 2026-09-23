"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, Palette, Plug, ShieldCheck, Mail, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { href: "/admin/settings", label: "Geral", icon: Building2 },
  { href: "/admin/settings/appearance", label: "Aparência", icon: Palette },
  { href: "/admin/settings/users", label: "Usuários", icon: UserRound },
  { href: "/admin/settings/courses", label: "Cursos", icon: BookOpen },
  { href: "/admin/settings/communication", label: "Comunicação", icon: Mail },
  { href: "/admin/settings/security", label: "Segurança", icon: ShieldCheck },
  { href: "/admin/settings/integrations", label: "Integrações", icon: Plug },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Categorias de configuração" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border lg:min-w-0 lg:flex-col lg:gap-px lg:border-0">
        {SETTINGS_SECTIONS.map((s) => {
          const active = pathname === s.href;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-2.5 px-3 text-sm font-medium transition-colors lg:h-9 lg:rounded-md lg:px-2.5",
                  "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full lg:after:hidden",
                  active ? "text-fg after:bg-primary lg:bg-surface-3/80" : "text-muted after:bg-transparent hover:text-fg lg:hover:bg-surface-2",
                )}
              >
                <s.icon className={cn("hidden size-4 lg:block", active ? "text-primary" : "text-subtle")} aria-hidden />
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
