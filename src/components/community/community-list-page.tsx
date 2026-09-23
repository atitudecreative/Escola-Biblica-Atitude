import Link from "next/link";
import { MessageSquarePlus, MessagesSquare, SearchX } from "lucide-react";
import type { SessionUser } from "@/server/auth/session";
import { communityCourses, listThreads, mutedUntil } from "@/server/services/community";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";
import { TableToolbar, type ToolbarFilter } from "@/components/data/table-toolbar";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ThreadList } from "./thread-list";

/** Listagem compartilhada por /community e /community/questions. */
export async function CommunityListPage({
  user,
  searchParams,
  mode,
}: {
  user: SessionUser;
  searchParams: Record<string, string | string[] | undefined>;
  mode: "all" | "questions";
}) {
  const raw = Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  if (mode === "questions") raw.type = "QUESTION";
  const [{ threads, total, page, pageSize, filters }, courses, muted] = await Promise.all([
    listThreads(user, raw),
    communityCourses(user),
    mutedUntil(user.id),
  ]);
  const base = mode === "questions" ? "/community/questions" : "/community";
  const newHref = mode === "questions" ? "/community/new?type=QUESTION" : "/community/new";
  const hasFilters = !!(filters.q || filters.course || filters.status || (mode === "all" && filters.type) || filters.sort === "unanswered");

  const toolbar: ToolbarFilter[] = [
    ...(courses.length ? [{ name: "course", label: "Todos os cursos", options: courses.map((c) => ({ value: c.id, label: c.title })) }] : []),
    ...(mode === "all"
      ? [{ name: "type", label: "Todos os tipos", options: [{ value: "QUESTION", label: "Perguntas" }, { value: "DISCUSSION", label: "Discussões" }] }]
      : [{ name: "status", label: "Todas as perguntas", options: [{ value: "unanswered", label: "Sem resposta" }, { value: "solved", label: "Resolvidas" }] }]),
    {
      name: "sort",
      label: "Mais recentes",
      options: [
        { value: "popular", label: "Mais populares" },
        ...(mode === "all" ? [{ value: "unanswered", label: "Sem resposta" }] : []),
      ],
    },
  ];

  function hrefFor(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (v && k !== "page" && !(mode === "questions" && k === "type")) sp.set(k, String(v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `${base}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        title={mode === "questions" ? "Perguntas" : "Discussões"}
        description={
          mode === "questions"
            ? "Tire dúvidas com professores e colegas. Quem pergunta marca a resposta que resolveu."
            : "Converse sobre os cursos, compartilhe aprendizados e ajude outros alunos."
        }
        actions={
          <Button asChild>
            <Link href={newHref}>
              <MessageSquarePlus /> {mode === "questions" ? "Fazer pergunta" : "Nova discussão"}
            </Link>
          </Button>
        }
      />
      {muted && (
        <Alert tone="warning" className="mb-5" title="Participação suspensa">
          Você pode ler as discussões, mas só poderá publicar ou responder a partir de {formatDateTime(muted)}.
        </Alert>
      )}
      <TableToolbar placeholder={mode === "questions" ? "Buscar perguntas" : "Buscar discussões"} filters={toolbar} className="mb-4">
        <span className="text-small text-muted">
          {formatNumber(total)} {total === 1 ? (mode === "questions" ? "pergunta" : "tópico") : mode === "questions" ? "perguntas" : "tópicos"}
        </span>
      </TableToolbar>
      {threads.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="Nada encontrado com esses filtros"
            description="Tente outras palavras ou limpe os filtros."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={base}>Limpar filtros</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title={mode === "questions" ? "Nenhuma pergunta ainda" : "Nenhuma discussão ainda"}
            description="Seja a primeira pessoa a puxar a conversa."
            action={
              <Button asChild size="sm">
                <Link href={newHref}>{mode === "questions" ? "Fazer pergunta" : "Começar discussão"}</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <ThreadList threads={threads} />
          <Pagination className="mt-5" page={page} pageSize={pageSize} total={total} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
