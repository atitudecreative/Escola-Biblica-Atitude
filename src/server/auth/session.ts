import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db";
import { isProd } from "@/server/env";
import { generateToken, hashToken } from "./crypto";
import type { Permission, RoleKey } from "@/lib/permissions";

export const SESSION_COOKIE = "eba_session";
const DAY = 24 * 60 * 60 * 1000;
const REMEMBER_TTL = 30 * DAY;
const SHORT_TTL = 1 * DAY;
const TOUCH_INTERVAL = 15 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  headline: string | null;
  emailVerified: boolean;
  roles: RoleKey[];
  permissions: Set<Permission>;
  sessionId: string;
  xp: number;
};

async function requestMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 400) ?? null };
}

/** Cria a sessão e grava o cookie. Só pode ser chamado em Server Actions / Route Handlers. */
export async function createSession(userId: string, remember: boolean) {
  const token = generateToken();
  const ttl = remember ? REMEMBER_TTL : SHORT_TTL;
  const meta = await requestMeta();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + ttl),
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    // Sem "lembrar acesso" o cookie é de sessão do navegador.
    ...(remember ? { maxAge: ttl / 1000 } : {}),
  });
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

/**
 * Resolve o usuário da requisição atual (memoizado por requisição).
 * Retorna null para visitantes, sessões expiradas/revogadas e contas bloqueadas.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const { user } = session;
  if (user.status !== "ACTIVE") return null;

  // Atualização "preguiçosa" de atividade: no máximo a cada 15 min.
  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL) {
    const now = new Date();
    await Promise.all([
      db.session.update({ where: { id: session.id }, data: { lastUsedAt: now } }),
      db.user.update({ where: { id: user.id }, data: { lastSeenAt: now } }),
    ]).catch(() => undefined);
  }

  const permissions = new Set<Permission>();
  for (const ur of user.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.key as Permission);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    headline: user.headline,
    emailVerified: !!user.emailVerifiedAt,
    roles: user.roles.map((r) => r.role.key as RoleKey),
    permissions,
    sessionId: session.id,
    xp: user.xp,
  };
});
