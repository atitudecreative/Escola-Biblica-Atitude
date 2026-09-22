"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award, BarChart3, Bell, BookOpen, Bookmark, Check, ClipboardList, Compass, FileBarChart, Gauge, GraduationCap,
  HelpCircle, Home, Image, Layers, Megaphone, MessageSquare, Presentation, ScrollText, Settings, Shield, Tags, Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav-config";

const ICONS: Record<string, LucideIcon> = {
  home: Home, book: BookOpen, compass: Compass, clipboard: ClipboardList, bookmark: Bookmark, award: Award,
  message: MessageSquare, bell: Bell, megaphone: Megaphone, users: Users, help: HelpCircle, gauge: Gauge,
  layers: Layers, graduation: GraduationCap, check: Check, chart: BarChart3, "file-chart": FileBarChart,
  presentation: Presentation, tags: Tags, image: Image, settings: Settings, shield: Shield, scroll: ScrollText,
};

export type NavCounts = { messages: number; notifications: number; grading: number };

export function SidebarNav({ sections, counts, onNavigate }: { sections: NavSection[]; counts: NavCounts; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-5 px-3 py-4">
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && <p className="mb-1 px-2.5 text-overline text-subtle">{section.title}</p>}
          <ul className="flex flex-col gap-px">
            {section.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = ICONS[item.icon] ?? Home;
              const count = item.badge ? counts[item.badge] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                      active ? "bg-surface-3/80 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-subtle group-hover:text-muted")} aria-hidden />
                    <span className="truncate">{item.label}</span>
                    {count > 0 && (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-fg tabular-nums">
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> não lidos</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
