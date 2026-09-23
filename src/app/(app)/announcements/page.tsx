import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Send } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { listAnnouncementsFor } from "@/server/services/announcements";
import { announcementCourses, canAnnounce, listSentAnnouncements } from "@/server/services/announcement-audience";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { AnnouncementComposer } from "@/components/communication/announcement-composer";
import { dayLabel, clock, fullDateTime } from "@/components/communication/time";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Comunicados" };

const ROLE_PLURAL: Record<string, string> = { student: "Alunos", teacher: "Professores", manager: "Gestores", admin: "Administradores" };

type Row = Awaited<ReturnType<typeof listAnnouncementsFor>>[number];

function audienceLabel(a: Row, meId: string) {
  switch (a.audience) {
    case "ALL":
      return { label: "Todos", tone: "neutral" as const };
    case "ROLE":
      return { label: ROLE_PLURAL[a.roleKey ?? ""] ?? "Perfil", tone: "info" as const };
    case "COURSE":
      return { label: a.course?.title ?? "Curso", tone: "primary" as const };
    case "USER":
      return { label: a.targetUserId === meId ? "Para você" : `Para ${a.targetUser?.name ?? "uma pessoa"}`, tone: "accent" as const };
  }
}

export default async function AnnouncementsPage({ searchParams }: PageProps<"/announcements">) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const author = canAnnounce(user);
  const tab = author && sp.tab === "sent" ? "sent" : "inbox";
  const [items, courses] = await Promise.all([
    tab === "sent" ? listSentAnnouncements(user) : listAnnouncementsFor(user, { take: 60 }),
    author ? announcementCourses(user) : Promise.resolve([]),
  ]);
  const visible = tab === "inbox" ? items.filter((a) => !author || a.authorId !== user.id) : items;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Comunicados"
        description="Avisos oficiais da Escola e dos seus professores."
        actions={author ? <AnnouncementComposer courses={courses} canAll={user.permissions.has("announcements.all")} /> : undefined}
      />
      {author && (
        <nav aria-label="Comunicados" className="mb-6 flex gap-1 border-b border-border">
          {(
            [
              ["inbox", "Recebidos", "/announcements"],
              ["sent", "Enviados", "/announcements?tab=sent"],
            ] as const
          ).map(([k, label, href]) => (
            <Link
              key={k}
              href={href}
              aria-current={tab === k ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex h-10 items-center px-3 text-sm font-medium transition-colors",
                tab === k ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted hover:text-fg",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

      {visible.length === 0 ? (
        tab === "sent" ? (
          <EmptyState
            icon={Send}
            title="Você ainda não enviou comunicados"
            description="Use comunicados para avisar turmas sobre aulas ao vivo, prazos e materiais novos."
            action={<AnnouncementComposer courses={courses} canAll={user.permissions.has("announcements.all")} />}
          />
        ) : (
          <EmptyState
            icon={Megaphone}
            title="Nenhum comunicado por enquanto"
            description="Quando a Escola ou seus professores publicarem avisos, eles aparecerão aqui e no sino de notificações."
            action={
              <Link href="/my-courses" className="text-small font-medium text-primary hover:underline">
                Ir para meus cursos
              </Link>
            }
          />
        )
      ) : (
        <ol className="space-y-4">
          {visible.map((a) => {
            const aud = audienceLabel(a, user.id);
            return (
              <li key={a.id} id={a.id} className="scroll-mt-24">
                <article className="rounded-xl border border-border bg-surface px-5 py-5 shadow-xs target:ring-2 target:ring-primary sm:px-6">
                  <header className="flex items-start gap-3">
                    <Avatar name={a.author.name} src={a.author.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium text-fg">{a.author.name}</span>
                        {a.author.headline && <span className="text-muted"> · {a.author.headline}</span>}
                      </p>
                      <p className="text-caption text-subtle" title={fullDateTime(a.createdAt)} suppressHydrationWarning>
                        {dayLabel(a.createdAt)} às {clock(a.createdAt)}
                      </p>
                    </div>
                    <Badge tone={aud.tone} className="max-w-[45%] truncate">
                      <span className="truncate">{aud.label}</span>
                    </Badge>
                  </header>
                  <h2 className="mt-4 text-h3 text-balance text-fg">{a.title}</h2>
                  <Markdown className="mt-2">{a.body}</Markdown>
                  {tab === "sent" && (
                    <footer className="mt-4 border-t border-border pt-3 text-caption text-muted">
                      Enviado para {formatNumber(a.recipients)} {a.recipients === 1 ? "pessoa" : "pessoas"}
                    </footer>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
