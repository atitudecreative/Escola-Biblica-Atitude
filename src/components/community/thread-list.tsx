import Link from "next/link";
import { CheckCircle2, Eye, Heart, Lock, MessageSquare, Pin } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { relative } from "@/components/communication/time";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { listThreads } from "@/server/services/community";

type Thread = Awaited<ReturnType<typeof listThreads>>["threads"][number];

function Stat({ icon: Icon, value, label, active }: { icon: typeof Heart; value: number; label: string; active?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", active ? "text-success" : "text-subtle")} title={`${value} ${label}`}>
      <Icon className="size-3.5" aria-hidden />
      <span className="text-caption font-medium">{formatCompact(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ThreadList({ threads }: { threads: Thread[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      {threads.map((t) => {
        const solved = !!t.solutionReplyId;
        const repliers = [...new Map(t.replies.map((r) => [r.author.name, r.author])).values()];
        return (
          <li key={t.id} className={cn("relative transition-colors hover:bg-surface-2/60", t.isPinned && "bg-accent-soft/20")}>
            <div className="flex gap-3 px-4 py-4 sm:px-5">
              <Avatar name={t.author.name} src={t.author.avatarUrl} size="sm" className="mt-0.5 hidden sm:inline-flex" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.isPinned && (
                    <Badge tone="accent">
                      <Pin /> Fixada
                    </Badge>
                  )}
                  {t.type === "QUESTION" && <Badge tone={solved ? "success" : "info"}>{solved ? <><CheckCircle2 /> Resolvida</> : "Pergunta"}</Badge>}
                  {t.isLocked && (
                    <Badge>
                      <Lock /> Trancada
                    </Badge>
                  )}
                  {t.course && <span className="truncate text-caption text-muted">{t.course.title}</span>}
                </div>
                <h3 className="mt-1.5 text-[0.9375rem] leading-snug font-semibold text-fg">
                  <Link href={`/community/${t.id}`} className="after:absolute after:inset-0 hover:underline focus-visible:outline-none">
                    {t.title}
                  </Link>
                </h3>
                <p className="mt-1 line-clamp-1 text-small text-muted">{t.body.replace(/[#*_>`[\]]/g, "").slice(0, 200)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-subtle">
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={t.author.name} src={t.author.avatarUrl} size="xs" className="sm:hidden" />
                    <span className="font-medium text-muted">{t.author.name}</span>
                  </span>
                  <span suppressHydrationWarning>
                    {t.replyCount ? "última atividade" : "publicada"} {relative(t.lastActivityAt)}
                  </span>
                  <span className="flex items-center gap-3 sm:hidden">
                    <Stat icon={MessageSquare} value={t.replyCount} label="respostas" active={solved} />
                    <Stat icon={Heart} value={t.likeCount} label="curtidas" />
                    <Stat icon={Eye} value={t.viewCount} label="visualizações" />
                  </span>
                </div>
              </div>
              <div className="hidden shrink-0 items-center gap-5 self-center sm:flex">
                {repliers.length > 0 && <AvatarStack people={repliers} max={3} size="xs" />}
                <div className="grid w-40 grid-cols-3 text-center">
                  <Metric value={t.replyCount} label="respostas" highlight={solved} />
                  <Metric value={t.likeCount} label="curtidas" />
                  <Metric value={t.viewCount} label="visitas" />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Metric({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div>
      <div className={cn("text-sm font-semibold tabular-nums", highlight ? "text-success" : value ? "text-fg" : "text-subtle")}>{formatCompact(value)}</div>
      <div className="text-[0.6875rem] text-subtle">{label}</div>
    </div>
  );
}
