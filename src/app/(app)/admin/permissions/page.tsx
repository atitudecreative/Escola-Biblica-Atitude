import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/guards";
import { getRoleMatrix, LOCKED_ADMIN_PERMISSIONS } from "@/server/services/admin-roles";
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionMatrix } from "@/components/admin-config/permissions/permission-matrix";

export const metadata: Metadata = { title: "Permissões · Administração" };

export default async function PermissionsPage() {
  await requirePermissionPage("roles.manage");
  const roles = await getRoleMatrix();
  const groups: { name: string; perms: { key: string; description: string }[] }[] = [];
  for (const key of ALL_PERMISSIONS) {
    const { group, description } = PERMISSIONS[key];
    let g = groups.find((x) => x.name === group);
    if (!g) groups.push((g = { name: group, perms: [] }));
    g.perms.push({ key, description });
  }
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Perfis e permissões"
        description="Defina o que cada perfil pode fazer. Um usuário com mais de um perfil soma as permissões de todos. As mudanças valem na próxima página que a pessoa abrir."
      />
      <PermissionMatrix roles={roles} groups={groups} locked={LOCKED_ADMIN_PERMISSIONS} />
    </>
  );
}
