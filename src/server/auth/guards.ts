import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser, type SessionUser } from "./session";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";
import type { Permission } from "@/lib/permissions";

/**
 * Guardas de autorização. Há duas famílias:
 *  - require*Page: para Server Components — redirecionam (login) ou mostram 404/403.
 *  - assert*:      para serviços e Server Actions — lançam erros de domínio.
 */

export async function requireUserPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return user;
}

export async function requirePermissionPage(...perms: Permission[]): Promise<SessionUser> {
  const user = await requireUserPage();
  if (!perms.some((p) => user.permissions.has(p))) redirect("/dashboard?denied=1");
  return user;
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Exige ao menos UMA das permissões informadas. */
export async function assertPermission(...perms: Permission[]): Promise<SessionUser> {
  const user = await assertUser();
  if (!perms.some((p) => user.permissions.has(p))) throw new ForbiddenError();
  return user;
}

export function can(user: SessionUser | null | undefined, p: Permission) {
  return !!user?.permissions.has(p);
}
