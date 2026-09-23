import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/guards";
import { CommunityListPage } from "@/components/community/community-list-page";

export const metadata: Metadata = { title: "Perguntas" };

export default async function QuestionsPage({ searchParams }: PageProps<"/community/questions">) {
  const user = await requirePermissionPage("community.participate", "community.moderate");
  return <CommunityListPage user={user} searchParams={await searchParams} mode="questions" />;
}
