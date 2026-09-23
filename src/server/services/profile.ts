import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { NotFoundError } from "@/server/errors";
import { DEFAULT_PRIVACY, privacySchema, type Privacy } from "@/lib/validation/profile";

export async function getProfile(userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, bio: true, headline: true, avatarUrl: true, createdAt: true, xp: true,
      emailVerifiedAt: true, preferences: true,
      roles: { select: { role: { select: { key: true, name: true } } } },
    },
  });
}

export async function updateProfile(userId: string, data: { name: string; headline?: string; phone?: string; bio?: string; avatarUrl?: string | null }) {
  if (data.avatarUrl) {
    // Só aceita avatar enviado pelo próprio usuário.
    const id = data.avatarUrl.split("/").pop()!;
    const file = await db.fileAsset.findUnique({ where: { id } });
    if (!file || file.ownerId !== userId) throw new NotFoundError("Imagem inválida.");
  }
  await db.user.update({
    where: { id: userId },
    data: { name: data.name, headline: data.headline || null, phone: data.phone || null, bio: data.bio || null, ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}) },
  });
  await audit("profile.updated", { actorId: userId, entityType: "user", entityId: userId });
}

export function readPrivacy(preferences: unknown): Privacy {
  const p = (preferences as { privacy?: unknown } | null)?.privacy;
  const parsed = privacySchema.safeParse(p);
  return parsed.success ? parsed.data : DEFAULT_PRIVACY;
}

export async function savePrivacy(userId: string, privacy: Privacy) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { preferences: true } });
  const prefs = { ...((user.preferences as object) ?? {}), privacy };
  await db.user.update({ where: { id: userId }, data: { preferences: prefs } });
}

export async function listSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
  });
}

export async function revokeSession(userId: string, sessionId: string) {
  await db.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit("auth.session_revoked", { actorId: userId, entityType: "session", entityId: sessionId });
}
