import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertPermission } from "@/server/auth/guards";
import { NotFoundError, ValidationError } from "@/server/errors";
import { parseInput } from "@/server/action";
import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

/**
 * Perfis × permissões (RBAC). Permissão: roles.manage.
 * Proteção anti-trancamento: o perfil admin sempre mantém roles.manage e settings.manage.
 */
export const LOCKED_ADMIN_PERMISSIONS: Permission[] = ["roles.manage", "settings.manage"];

/** Garante que toda permissão do catálogo exista na tabela permissions. */
async function syncPermissionCatalog() {
  const existing = await db.permission.findMany({ select: { key: true } });
  const have = new Set(existing.map((p) => p.key));
  const missing = ALL_PERMISSIONS.filter((k) => !have.has(k));
  if (missing.length)
    await db.permission.createMany({
      data: missing.map((key) => ({ key, group: PERMISSIONS[key].group, description: PERMISSIONS[key].description })),
      skipDuplicates: true,
    });
  return db.permission.findMany({ select: { id: true, key: true } });
}

export async function getRoleMatrix() {
  await assertPermission("roles.manage");
  await syncPermissionCatalog();
  const roles = await db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    include: { permissions: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
  });
  const order = ["student", "teacher", "manager", "admin"];
  roles.sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.createdAt.getTime() - b.createdAt.getTime();
  });
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    users: r._count.users,
    permissions: r.permissions.map((p) => p.permission.key).filter((k): k is Permission => k in PERMISSIONS),
  }));
}

const permList = z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])).max(ALL_PERMISSIONS.length);

export const matrixInput = z.record(z.string(), permList);

/** Salva a matriz inteira (apenas perfis alterados são tocados). */
export async function saveRoleMatrix(input: unknown) {
  const actor = await assertPermission("roles.manage");
  const matrix = parseInput(matrixInput, input);
  const catalog = await syncPermissionCatalog();
  const idByKey = new Map(catalog.map((p) => [p.key, p.id]));
  const roles = await db.role.findMany({ include: { permissions: { include: { permission: { select: { key: true } } } } } });

  const changes: { role: string; added: string[]; removed: string[] }[] = [];
  for (const [roleId, perms] of Object.entries(matrix)) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) throw new NotFoundError("Um dos perfis não existe mais. Recarregue a página.");
    const next = new Set(perms);
    if (role.key === "admin") {
      const missing = LOCKED_ADMIN_PERMISSIONS.filter((p) => !next.has(p));
      if (missing.length)
        throw new ValidationError(
          `O perfil Administrador precisa manter "${PERMISSIONS[missing[0]].description}" para não trancar a plataforma.`,
        );
    }
    const current = new Set(role.permissions.map((p) => p.permission.key));
    const added = [...next].filter((k) => !current.has(k));
    const removed = [...current].filter((k) => !next.has(k as Permission));
    if (!added.length && !removed.length) continue;
    changes.push({ role: role.key, added, removed });
    await db.$transaction([
      db.rolePermission.deleteMany({
        where: { roleId, permission: { key: { in: removed } } },
      }),
      db.rolePermission.createMany({
        data: added.map((k) => ({ roleId, permissionId: idByKey.get(k)! })),
        skipDuplicates: true,
      }),
    ]);
  }
  for (const c of changes)
    await audit("roles.permissions_updated", { actorId: actor.id, entityType: "role", entityId: c.role, metadata: { added: c.added, removed: c.removed } });
  return changes.length;
}

export const customRoleInput = z.object({
  name: z.string().trim().min(3, "Informe o nome do perfil").max(40, "Máximo de 40 caracteres"),
  description: z.string().trim().max(160, "Máximo de 160 caracteres").optional().default(""),
  permissions: permList.default([]),
  copyFrom: z.string().optional(),
});

export async function createCustomRole(input: unknown) {
  const actor = await assertPermission("roles.manage");
  const data = parseInput(customRoleInput, input);
  const base = slugify(data.name).replace(/-/g, "_").slice(0, 30);
  if (!base) throw new ValidationError(undefined, { name: "Use letras ou números no nome" });
  let key = `custom_${base}`;
  for (let i = 2; await db.role.findUnique({ where: { key } }); i++) key = `custom_${base}_${i}`;
  if (await db.role.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } }))
    throw new ValidationError(undefined, { name: "Já existe um perfil com este nome" });

  let perms = data.permissions;
  if (data.copyFrom) {
    const src = await db.role.findUnique({ where: { id: data.copyFrom }, include: { permissions: { include: { permission: true } } } });
    if (src) perms = src.permissions.map((p) => p.permission.key as Permission);
  }
  const catalog = await syncPermissionCatalog();
  const idByKey = new Map(catalog.map((p) => [p.key, p.id]));
  const role = await db.role.create({
    data: {
      key,
      name: data.name,
      description: data.description || null,
      isSystem: false,
      permissions: { create: perms.filter((k) => idByKey.has(k)).map((k) => ({ permissionId: idByKey.get(k)! })) },
    },
  });
  await audit("roles.created", { actorId: actor.id, entityType: "role", entityId: role.key, metadata: { name: data.name, permissions: perms } });
  return role.id;
}

export async function deleteCustomRole(roleId: string) {
  const actor = await assertPermission("roles.manage");
  const role = await db.role.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
  if (!role) throw new NotFoundError("Perfil não encontrado.");
  if (role.isSystem) throw new ValidationError("Perfis do sistema não podem ser excluídos.");
  if (role._count.users > 0)
    throw new ValidationError(`Este perfil ainda tem ${role._count.users} usuário(s). Remova-os do perfil antes de excluir.`);
  await db.role.delete({ where: { id: roleId } });
  await audit("roles.deleted", { actorId: actor.id, entityType: "role", entityId: role.key, metadata: { name: role.name } });
}
