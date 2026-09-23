import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/guards";
import { listCategories, listTags } from "@/server/services/admin-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { FilterTabs } from "@/components/admin-config/filter-tabs";
import { CategoriesManager } from "@/components/admin-config/catalog/categories-manager";
import { TagsManager } from "@/components/admin-config/catalog/tags-manager";

export const metadata: Metadata = { title: "Categorias e tags · Administração" };

export default async function CategoriesPage(props: PageProps<"/admin/categories">) {
  await requirePermissionPage("categories.manage");
  const sp = await props.searchParams;
  const tab = sp.tab === "tags" ? "tags" : "categories";
  const [categories, tags] = await Promise.all([listCategories(), listTags()]);
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Categorias e tags"
        description="Organize o catálogo: categorias agrupam os cursos na navegação; tags descrevem temas e facilitam a busca."
      />
      <FilterTabs
        className="mb-6"
        label="Seções"
        items={[
          { label: "Categorias", href: "/admin/categories", active: tab === "categories", count: categories.length },
          { label: "Tags", href: "/admin/categories?tab=tags", active: tab === "tags", count: tags.length },
        ]}
      />
      <div className="max-w-3xl">
        {tab === "categories" ? (
          <CategoriesManager
            categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon, courses: c._count.courses }))}
          />
        ) : (
          <TagsManager tags={tags} />
        )}
      </div>
    </>
  );
}
