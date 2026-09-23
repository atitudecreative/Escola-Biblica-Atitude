"use client";
import { RelativeTime } from "@/components/ui/relative-time";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import type { Notification } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { markNotificationsReadAction, recentNotificationsAction } from "@/app/(app)/shell-actions";

import { cn } from "@/lib/utils";

export function NotificationsPopover({ unread }: { unread: number }) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function load() {
    start(async () => {
      const res = await recentNotificationsAction();
      if (res.ok) {
        setItems(res.data);
        setError(false);
      } else setError(true);
    });
  }

  function markAll() {
    start(async () => {
      await markNotificationsReadAction();
      setItems((list) => list?.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })) ?? null);
    });
  }

  return (
    <Popover onOpenChange={(o) => o && load()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`} className="relative">
          <Bell />
          {unread > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-danger ring-2 ring-surface" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-h4">Notificações</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} disabled={pending}>
              <CheckCheck /> Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {error ? (
            <p className="px-4 py-8 text-center text-small text-muted">Não foi possível carregar. Tente novamente.</p>
          ) : !items ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto size-5 text-subtle" />
              <p className="mt-2 text-small text-muted">Tudo em dia. Nenhuma notificação por aqui.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "/notifications"}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                    onClick={() => !n.readAt && markNotificationsReadAction([n.id])}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className="min-w-0">
                      <span className={cn("block text-sm", n.readAt ? "text-muted" : "font-medium text-fg")}>{n.title}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-small text-muted">{n.body}</span>}
                      <span className="mt-1 block text-caption text-subtle"><RelativeTime date={n.createdAt} /></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications">Ver todas</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
