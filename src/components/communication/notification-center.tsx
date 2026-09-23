"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Award, Bell, BookOpen, Check, CheckCheck, ClipboardCheck, ClipboardList, GraduationCap, Megaphone, MessageSquare, Settings2, Trophy, Users,
  type LucideIcon,
} from "lucide-react";
import type { Notification, NotificationType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toaster";
import { NOTIFICATION_TYPE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { loadMoreNotificationsAction, markNotificationsAction } from "@/app/(app)/notifications/actions";
import { dayKey, dayLabel, clock, fullDateTime } from "./time";

export const NOTIFICATION_ICON: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  MESSAGE: { icon: MessageSquare, tone: "bg-info-soft text-info" },
  ANNOUNCEMENT: { icon: Megaphone, tone: "bg-accent-soft text-accent-soft-fg" },
  COMMUNITY: { icon: Users, tone: "bg-primary-soft text-primary" },
  NEW_LESSON: { icon: BookOpen, tone: "bg-primary-soft text-primary" },
  COURSE: { icon: GraduationCap, tone: "bg-primary-soft text-primary" },
  NEW_ASSIGNMENT: { icon: ClipboardList, tone: "bg-warning-soft text-warning" },
  ASSIGNMENT_GRADED: { icon: ClipboardCheck, tone: "bg-success-soft text-success" },
  QUIZ_GRADED: { icon: ClipboardCheck, tone: "bg-success-soft text-success" },
  CERTIFICATE: { icon: Award, tone: "bg-accent-soft text-accent-soft-fg" },
  ACHIEVEMENT: { icon: Trophy, tone: "bg-accent-soft text-accent-soft-fg" },
  SYSTEM: { icon: Settings2, tone: "bg-surface-3 text-muted" },
};

type Item = Pick<Notification, "id" | "type" | "title" | "body" | "link" | "readAt" | "createdAt">;

export function NotificationCenter(props: { initial: Item[]; initialHasMore: boolean; unreadOnly: boolean; type: NotificationType | null; unreadTotal: number }) {
  const router = useRouter();
  const [unreadTotal, setUnreadTotal] = useState(props.unreadTotal);
  const [marking, startMarking] = useTransition();
  const [version, setVersion] = useState(0);

  function hrefFor(next: { unread?: boolean; type?: string | null }) {
    const sp = new URLSearchParams();
    const unread = next.unread ?? props.unreadOnly;
    const type = next.type === undefined ? props.type : next.type;
    if (unread) sp.set("filter", "unread");
    if (type) sp.set("type", type);
    const qs = sp.toString();
    return `/notifications${qs ? `?${qs}` : ""}`;
  }

  function markAll() {
    startMarking(async () => {
      const res = await markNotificationsAction(null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Tudo lido.");
      setUnreadTotal(0);
      setVersion((v) => v + 1);
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div role="tablist" aria-label="Filtrar por leitura" className="inline-flex self-start rounded-lg bg-surface-2 p-0.5">
          {(
            [
              [false, "Todas"],
              [true, unreadTotal ? `Não lidas · ${unreadTotal}` : "Não lidas"],
            ] as const
          ).map(([u, label]) => (
            <Link
              key={String(u)}
              role="tab"
              aria-selected={props.unreadOnly === u}
              href={hrefFor({ unread: u })}
              scroll={false}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-small font-medium transition-all",
                props.unreadOnly === u ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        <NativeSelect
          aria-label="Filtrar por tipo"
          value={props.type ?? ""}
          onChange={(e) => router.push(hrefFor({ type: e.target.value || null }), { scroll: false })}
          className="sm:w-56"
        >
          <option value="">Todos os tipos</option>
          {(Object.keys(NOTIFICATION_TYPE) as NotificationType[]).map((t) => (
            <option key={t} value={t}>
              {NOTIFICATION_TYPE[t]}
            </option>
          ))}
        </NativeSelect>
        {unreadTotal > 0 && (
          <Button variant="ghost" size="sm" className="sm:ml-auto" onClick={markAll} loading={marking}>
            <CheckCheck /> Marcar todas como lidas
          </Button>
        )}
      </div>
      <NotificationList
        key={`${props.unreadOnly}-${props.type}-${version}`}
        {...props}
        allRead={version > 0}
        onRead={() => setUnreadTotal((n) => Math.max(0, n - 1))}
      />
    </div>
  );
}

function NotificationList({
  initial,
  initialHasMore,
  unreadOnly,
  type,
  allRead,
  onRead,
}: {
  initial: Item[];
  initialHasMore: boolean;
  unreadOnly: boolean;
  type: NotificationType | null;
  allRead: boolean;
  onRead: () => void;
}) {
  const [items, setItems] = useState(() => (allRead ? (unreadOnly ? [] : initial.map((n) => ({ ...n, readAt: n.readAt ?? new Date() }))) : initial));
  const [hasMore, setHasMore] = useState(allRead && unreadOnly ? false : initialHasMore);
  const [loading, startLoading] = useTransition();

  function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;
    startLoading(async () => {
      const res = await loadMoreNotificationsAction({ cursor: last.id, unreadOnly, type });
      if (!res.ok) return void toast.error(res.error);
      setItems((list) => [...list, ...res.data.items.filter((n) => !list.some((x) => x.id === n.id))]);
      setHasMore(res.data.hasMore);
    });
  }

  async function markOne(id: string) {
    if (items.find((n) => n.id === id)?.readAt) return;
    setItems((list) => list.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date() } : n)));
    onRead();
    const res = await markNotificationsAction([id]);
    if (!res.ok) toast.error(res.error);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title={unreadOnly ? "Nenhuma notificação não lida" : type ? `Nenhuma notificação de ${NOTIFICATION_TYPE[type].toLowerCase()}` : "Nenhuma notificação por aqui"}
        description={
          unreadOnly || type
            ? "Tente outro filtro para ver notificações anteriores."
            : "Quando houver novas aulas, respostas, mensagens ou comunicados, você verá tudo aqui."
        }
        action={
          unreadOnly || type ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/notifications">Ver todas</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/my-courses">Ir para meus cursos</Link>
            </Button>
          )
        }
      />
    );
  }

  const groups: { key: string; label: string; items: Item[] }[] = [];
  for (const n of items) {
    const k = dayKey(n.createdAt);
    const g = groups[groups.length - 1];
    if (g?.key === k) g.items.push(n);
    else groups.push({ key: k, label: dayLabel(n.createdAt), items: [n] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`d-${g.key}`}>
          <h2 id={`d-${g.key}`} suppressHydrationWarning className="mb-2 text-overline text-subtle">
            {g.label}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {g.items.map((n) => {
              const { icon: Icon, tone } = NOTIFICATION_ICON[n.type];
              const unread = !n.readAt;
              return (
                <li key={n.id} className={cn("group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60", unread && "bg-primary-soft/25")}>
                  <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", tone)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={n.link ?? "/notifications"}
                      onClick={() => unread && void markOne(n.id)}
                      className="block after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      <span className={cn("block text-sm", unread ? "font-semibold text-fg" : "font-medium text-fg/85")}>{n.title}</span>
                    </Link>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-small text-muted">{n.body}</p>}
                    <p className="mt-1 text-caption text-subtle" title={fullDateTime(n.createdAt)} suppressHydrationWarning>
                      {NOTIFICATION_TYPE[n.type]} · {clock(n.createdAt)}
                    </p>
                  </div>
                  <div className="relative z-10 flex shrink-0 items-center gap-2 self-center">
                    {unread ? (
                      <Tooltip content="Marcar como lida">
                        <button
                          onClick={() => markOne(n.id)}
                          className="flex size-10 items-center justify-center rounded-md text-subtle hover:bg-surface-3 hover:text-fg"
                          aria-label={`Marcar “${n.title}” como lida`}
                        >
                          <span className="size-2.5 rounded-full bg-primary group-hover:hidden" aria-hidden />
                          <Check className="hidden size-4 group-hover:block" aria-hidden />
                        </button>
                      </Tooltip>
                    ) : (
                      <span className="size-10" aria-hidden />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} loading={loading}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}
