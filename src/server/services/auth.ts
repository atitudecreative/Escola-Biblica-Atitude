import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { sendEmail } from "@/server/email";
import { getSettings } from "@/server/settings";
import { rateLimit } from "@/server/rate-limit";
import { AppError, ValidationError } from "@/server/errors";
import { logger } from "@/server/logger";
import { burnPasswordCheck, generateToken, hashPassword, hashToken, verifyPassword } from "@/server/auth/crypto";
import { createSession, revokeAllSessions } from "@/server/auth/session";
import type { AuthTokenType } from "@prisma/client";

const HOUR = 60 * 60 * 1000;

async function issueToken(userId: string, type: AuthTokenType, ttlMs: number) {
  // Invalida tokens anteriores do mesmo tipo: só o link mais recente funciona.
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const token = generateToken();
  await db.authToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

async function consumeToken(token: string, type: AuthTokenType) {
  const record = await db.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;
  await db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record;
}

export async function login(input: { email: string; password: string; remember: boolean }) {
  const security = await getSettings("security");
  await rateLimit("login:ip", security.maxLoginAttempts * 3, 15 * 60 * 1000);
  await rateLimit("login:email", security.maxLoginAttempts, 15 * 60 * 1000, input.email);

  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user?.passwordHash) {
    await burnPasswordCheck(input.password);
    throw new AppError("E-mail ou senha incorretos.", "INVALID_CREDENTIALS", 401);
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    await audit("auth.login_failed", { actorId: user.id, entityType: "user", entityId: user.id });
    throw new AppError("E-mail ou senha incorretos.", "INVALID_CREDENTIALS", 401);
  }
  if (user.status === "BLOCKED") throw new AppError("Sua conta está bloqueada. Fale com a secretaria da Escola.", "BLOCKED", 403);
  if (user.status === "INACTIVE") throw new AppError("Sua conta está inativa. Fale com a secretaria da Escola.", "INACTIVE", 403);

  const users = await getSettings("users");
  if (users.requireEmailVerification && !user.emailVerifiedAt) {
    throw new AppError("Confirme seu e-mail antes de entrar. Enviamos um link para sua caixa de entrada.", "EMAIL_NOT_VERIFIED", 403);
  }

  await createSession(user.id, input.remember);
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  await audit("auth.login", { actorId: user.id, entityType: "user", entityId: user.id });
  return user;
}

export async function register(input: { name: string; email: string; password: string }) {
  const [users, security] = await Promise.all([getSettings("users"), getSettings("security")]);
  if (!users.allowRegistration) throw new AppError("O cadastro de novas contas está temporariamente fechado.", "REGISTRATION_CLOSED", 403);
  if (input.password.length < security.minPasswordLength) {
    throw new ValidationError(undefined, { password: `A senha precisa ter pelo menos ${security.minPasswordLength} caracteres` });
  }
  await rateLimit("register", 5, HOUR);

  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new ValidationError(undefined, { email: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha." });

  const studentRole = await db.role.findUniqueOrThrow({ where: { key: "student" } });
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      roles: { create: { roleId: studentRole.id } },
    },
  });

  const token = await issueToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR);
  await sendEmail(user.email, "verify-email", { name: user.name.split(" ")[0], url: `/verify-email?token=${token}` }).catch((error) =>
    logger.error("auth.verify_email_send_failed", { error, category: "infra" }),
  );
  await audit("auth.register", { actorId: user.id, entityType: "user", entityId: user.id });

  if (!users.requireEmailVerification) await createSession(user.id, true);
  return { user, needsVerification: users.requireEmailVerification };
}

/** Sempre responde igual, exista ou não a conta (evita enumeração de e-mails). */
export async function requestPasswordReset(email: string) {
  await rateLimit("reset:ip", 10, HOUR);
  await rateLimit("reset:email", 3, HOUR, email);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status === "BLOCKED") return;
  const token = await issueToken(user.id, "PASSWORD_RESET", HOUR);
  await sendEmail(user.email, "password-reset", { name: user.name.split(" ")[0], url: `/reset-password?token=${token}` });
  await audit("auth.password_reset_requested", { actorId: user.id, entityType: "user", entityId: user.id });
}

/**
 * Envia, a pedido da administração, um link de definição de senha
 * (token PASSWORD_RESET). "invite" é usado ao criar a conta (validade maior).
 */
export async function sendPasswordLink(user: { id: string; email: string; name: string }, kind: "reset" | "invite" = "reset") {
  const token = await issueToken(user.id, "PASSWORD_RESET", kind === "invite" ? 72 * HOUR : HOUR);
  const data = { name: user.name.split(" ")[0], url: `/reset-password?token=${token}` };
  if (kind === "invite") await sendEmail(user.email, "account-invite", data);
  else await sendEmail(user.email, "password-reset", data);
}

export async function resetPassword(token: string, password: string) {
  await rateLimit("reset:confirm", 10, HOUR);
  const record = await consumeToken(token, "PASSWORD_RESET");
  if (!record) throw new AppError("Este link é inválido ou expirou. Solicite um novo.", "INVALID_TOKEN", 400);
  await db.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
  });
  await revokeAllSessions(record.userId);
  await audit("auth.password_reset", { actorId: record.userId, entityType: "user", entityId: record.userId });
}

export async function verifyEmail(token: string) {
  const record = await consumeToken(token, "EMAIL_VERIFICATION");
  if (!record) return false;
  await db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  await audit("auth.email_verified", { actorId: record.userId, entityType: "user", entityId: record.userId });
  return true;
}

export async function resendVerification(userId: string) {
  await rateLimit("verify:resend", 3, HOUR, userId);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) return;
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", 24 * HOUR);
  await sendEmail(user.email, "verify-email", { name: user.name.split(" ")[0], url: `/verify-email?token=${token}` });
}

export async function changePassword(userId: string, sessionId: string, current: string, next: string) {
  await rateLimit("password:change", 5, HOUR, userId);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, current))) {
    throw new ValidationError(undefined, { current: "Senha atual incorreta" });
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await revokeAllSessions(userId, sessionId);
  await audit("auth.password_changed", { actorId: userId, entityType: "user", entityId: userId });
}
