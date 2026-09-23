import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/guards";
import { CommunityListPage } from "@/components/community/community-list-page";

export const metadata: Metadata = { title: "Discussões" };

export default async function CommunityPage({ searchParams }: PageProps<"/community">) {
  const user = await requirePermissionPage("community.participate", "community.moderate");
  return <CommunityListPage user={user} searchParams={await searchParams} mode="all" />;
}
