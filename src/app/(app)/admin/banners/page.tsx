import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ExternalLink } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { listBanners, publishedCoursesForPicker } from "@/server/services/admin-cms";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/admin-config/filter-tabs";
import { BannersManager } from "@/components/admin-config/cms/banners-manager";
import { HomeEditor } from "@/components/admin-config/cms/home-editor";
import { FooterEditor } from "@/components/admin-config/cms/footer-editor";

export const metadata: Metadata = { title: "Banners e home · Administração" };

const TABS = [
  { key: "banners", label: "Banners" },
  { key: "home", label: "Página inicial" },
  { key: "footer", label: "Rodapé" },
] as const;

export default async function BannersPage(props: PageProps<"/admin/banners">) {
  await requirePermissionPage("banners.manage");
  await connection();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "banners";

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Banners e home"
        description="Conteúdo visual do site: banner principal da home, avisos do painel do aluno, seções da página inicial e rodapé."
        actions={
          <Button variant="outline" asChild>
            <Link href="/" target="_blank">
              <ExternalLink /> Ver home
            </Link>
          </Button>
        }
      />
      <FilterTabs
        className="mb-6"
        label="Seções"
        items={TABS.map((t) => ({ label: t.label, href: t.key === "banners" ? "/admin/banners" : `/admin/banners?tab=${t.key}`, active: tab === t.key }))}
      />
      <div className="max-w-4xl">
        {tab === "banners" && <BannersTab />}
        {tab === "home" && <HomeTab />}
        {tab === "footer" && <FooterEditor initial={await getSettings("footer")} />}
      </div>
    </>
  );
}

async function BannersTab() {
  const [banners, now] = await Promise.all([listBanners(), Promise.resolve(new Date())]);
  return (
    <BannersManager
      now={now.getTime()}
      banners={banners.map((b) => ({
        id: b.id,
        placement: b.placement,
        eyebrow: b.eyebrow ?? "",
        title: b.title,
        subtitle: b.subtitle ?? "",
        ctaLabel: b.ctaLabel ?? "",
        ctaHref: b.ctaHref ?? "",
        imageUrl: b.imageUrl ?? "",
        isActive: b.isActive,
        startsAt: b.startsAt?.toISOString() ?? null,
        endsAt: b.endsAt?.toISOString() ?? null,
      }))}
    />
  );
}

async function HomeTab() {
  const [home, courses] = await Promise.all([getSettings("home"), publishedCoursesForPicker()]);
  const published = new Set(courses.map((c) => c.id));
  return (
    <HomeEditor
      initial={{ ...home, featuredCourseIds: home.featuredCourseIds.filter((id) => published.has(id)) }}
      courses={courses.map((c) => ({ id: c.id, title: c.title, coverUrl: c.coverUrl, teacher: c.instructor.name, category: c.category?.name ?? null }))}
    />
  );
}
