"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award, BadgeCheck, BarChart3, Bell, BookOpen, Bookmark, Check, ClipboardList, Compass, FileBarChart, Gauge, GraduationCap,
  HelpCircle, Home, Image, Layers, Megaphone, MessageSquare, PanelLeftClose, PanelLeftOpen, Presentation, ScrollText,
  Settings, Shield, Tags, User, Users, type LucideIcon,
} from "lucide-react";
import { LogoFull, LogoMark } from "@/components/brand";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NavItem, NavSection } from "./nav-config";

const ICONS: Record<string, LucideIcon> = {
  home: Home, book: BookOpen, compass: Compass, clipboard: ClipboardList, bookmark: Bookmark, award: Award,
  message: MessageSquare, bell: Bell, megaphone: Megaphone, users: Users, help: HelpCircle, gauge: Gauge,
  layers: Layers, graduation: GraduationCap, check: Check, chart: BarChart3, "file-chart": FileBarChart,
  presentation: Presentation, tags: Tags, image: Image, settings: Settings, shield: Shield, scroll: ScrollText,
  user: User, "badge-check": BadgeCheck,
};

export type NavCounts = { messages: number; notifications: number; grading: number };

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/**
 * Item da navegação. As classes `sb-label`/`sb-rail` são controladas pelo shell (globals.css):
 * no modo trilho (recolhido ou tablet) os rótulos somem com fade e só os ícones ficam, centralizados.
 * O indicador lateral do item ativo cresce a partir do centro (scaleY), e o anterior encolhe.
 */
function NavLink({ item, count, rail, onNavigate }: { item: NavItem; count: number; rail: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item);
  const Icon = ICONS[item.icon] ?? Home;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={rail ? (count > 0 ? `${item.label} (${count} novos)` : item.label) : undefined}
      className={cn(
        "group/item relative flex h-10 items-center gap-3 rounded-lg px-[15px] text-sm font-medium whitespace-nowrap outline-none",
        "transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
        // indicador lateral, rente à borda da sidebar
        "before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-primary",
        "before:origin-center before:scale-y-0 before:transition-transform before:duration-300 before:ease-[var(--ease-out-soft)]",
        active
          ? "bg-primary-soft text-primary-soft-fg before:scale-y-100"
          : "text-muted hover:bg-surface-2 hover:text-fg active:bg-surface-3",
      )}
    >
      <span className="relative flex shrink-0">
        <Icon
          className={cn(
            "size-[18px] transition-[transform,color] duration-200 ease-[var(--ease-out-soft)]",
            active ? "fill-primary/15 text-primary" : "text-subtle group-hover/item:-translate-y-px group-hover/item:text-fg",
          )}
          aria-hidden
        />
        {count > 0 && <span className="sb-rail absolute -top-0.5 -right-0.5 size-2 rounded-full bg-danger ring-2 ring-surface" aria-hidden />}
      </span>
      <span className="sb-label truncate transition-transform duration-200 ease-[var(--ease-out-soft)] group-hover/item:translate-x-0.5">{item.label}</span>
      {count > 0 && (
        <span className="sb-label ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-fg tabular-nums">
          {count > 99 ? "99+" : count}
          <span className="sr-only"> novos</span>
        </span>
      )}
    </Link>
  );
  return (
    <MaybeTooltip content={item.label} enabled={rail}>
      {link}
    </MaybeTooltip>
  );
}

function MaybeTooltip({ content, enabled, children }: { content: string; enabled: boolean; children: React.ReactElement }) {
  return enabled ? (
    <Tooltip content={content} side="right">
      {children}
    </Tooltip>
  ) : (
    children
  );
}

export function SidebarNav({
  sections,
  counts,
  rail = false,
  onNavigate,
}: {
  sections: NavSection[];
  counts: NavCounts;
  /** Tooltips nos ícones (somente quando os rótulos estão ocultos). */
  rail?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-4 px-3 py-3">
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && (
            <div className="relative mb-1 h-6">
              <p className="sb-label absolute inset-x-0 top-1 px-[15px] text-overline text-subtle">{section.title}</p>
              <span className="sb-rail absolute top-3 left-1/2 h-px w-5 -translate-x-1/2 bg-border-strong" aria-hidden />
            </div>
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} count={item.badge ? counts[item.badge] : 0} rail={rail} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sidebar fixa (tablet e desktop). No tablet é sempre trilho; no desktop o usuário escolhe. */
export function Sidebar({
  brand,
  sections,
  counts,
  footer,
  rail,
  canToggle,
  collapsed,
  onToggle,
}: {
  brand: { name: string; logoUrl: string | null };
  sections: NavSection[];
  counts: NavCounts;
  footer?: React.ReactNode;
  rail: boolean;
  canToggle: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expandir menu" : "Recolher menu";
  return (
    <aside
      aria-label="Menu lateral"
      className="fixed inset-y-0 left-0 z-30 hidden w-(--sb) flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-300 ease-[var(--ease-out-soft)] md:flex"
    >
      <div className="flex h-15 shrink-0 items-center px-5">
        <Link href="/" aria-label={`${brand.name} — início`} className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {brand.logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo configurável pelo CMS */}
              <img src={brand.logoUrl} alt="" className="h-8 w-auto max-w-8 shrink-0 object-contain" />
              <span className="sb-label truncate text-[0.9375rem] leading-tight font-semibold tracking-tight text-fg">{brand.name}</span>
            </>
          ) : (
            // Expandida: logo completo; trilho: só o capelo, no mesmo ponto (troca com fade).
            <span className="relative flex h-11 items-center">
              <LogoFull className="sb-label" />
              <LogoMark className="sb-rail absolute top-2 left-0" />
            </span>
          )}
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:thin]">
        <SidebarNav sections={sections} counts={counts} rail={rail} />
      </div>
      <div className="shrink-0 border-t border-border px-3 py-3">
        {footer}
        {canToggle && (
          <MaybeTooltip content={toggleLabel} enabled={rail}>
            <button
              type="button"
              onClick={onToggle}
              aria-label={toggleLabel}
              aria-keyshortcuts="Control+B Meta+B"
              aria-expanded={!collapsed}
              className="group/t hidden h-10 w-full items-center gap-3 rounded-lg px-[15px] text-sm font-medium whitespace-nowrap text-subtle outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring lg:flex"
            >
              <ToggleIcon className="size-[18px] shrink-0 transition-transform duration-200 group-hover/t:scale-110" aria-hidden />
              <span className="sb-label">Recolher menu</span>
              <kbd className="sb-label ml-auto rounded border border-border px-1.5 font-sans text-[0.6875rem] text-subtle">Ctrl B</kbd>
            </button>
          </MaybeTooltip>
        )}
      </div>
    </aside>
  );
}
