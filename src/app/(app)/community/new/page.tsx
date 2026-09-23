import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/guards";
import { mutedUntil, postableCourses } from "@/server/services/community";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ThreadForm } from "@/components/community/thread-form";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Nova publicação" };

export default async function NewThreadPage({ searchParams }: PageProps<"/community/new">) {
  const user = await requirePermissionPage("community.participate", "community.moderate");
  const sp = await searchParams;
  const [courses, muted] = await Promise.all([postableCourses(user), mutedUntil(user.id)]);
  const type = sp.type === "QUESTION" ? "QUESTION" : sp.type === "DISCUSSION" ? "DISCUSSION" : "QUESTION";
  const course = typeof sp.course === "string" && courses.some((c) => c.id === sp.course) ? sp.course : null;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: "Comunidade", href: "/community" }, { label: "Nova publicação" }]}
        title="Nova publicação"
        description="Seja claro e respeitoso. Publicações que não seguem as diretrizes podem ser removidas pela moderação."
      />
      {muted ? (
        <Alert tone="warning" title="Participação suspensa" action={<Button asChild variant="outline" size="sm"><Link href="/community">Voltar</Link></Button>}>
          Você não pode publicar até {formatDateTime(muted)}. Se acha que houve um engano, fale com o suporte em Mensagens.
        </Alert>
      ) : (
        <ThreadForm courses={courses} defaultType={type} defaultCourse={course} />
      )}
    </div>
  );
}
