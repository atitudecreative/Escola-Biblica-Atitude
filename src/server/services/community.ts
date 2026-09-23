import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { parseInput } from "@/server/action";
import type { SessionUser } from "@/server/auth/session";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { formatDateTime } from "@/lib/format";
import { awardXp } from "./gamification";
import { notify } from "./notifications";

/**
 * Comunidade: discussões e perguntas, respostas, curtidas e moderação.
 *  - Participar: `community.participate` (e não estar silenciado).
 *  - Moderar (fixar, trancar, remover): `community.moderate` — tudo auditado.
 *  - Silenciar usuários: `users.manage` (User.communityMutedUntil).
 * Remoções são lógicas (deletedAt). Contadores (replyCount/likeCount) são
 * mantidos na mesma transação da escrita que os altera.
 */

export class MutedError extends AppError {
  constructor(until: Date) {
    super(`Sua participação na comunidade está suspensa até ${formatDateTime(until)}. Você ainda pode ler as discussões.`, "COMMUNITY_MUTED", 403);
  }
}

const canModerate = (u: SessionUser) => u.permissions.has("community.moderate");

function assertParticipant(user: SessionUser) {
  if (!user.permissions.has("community.participate") && !canModerate(user)) throw new ForbiddenError("Seu perfil não participa da comunidade.");
}

export async function mutedUntil(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { communityMutedUntil: true } });
  return u?.communityMutedUntil && u.communityMutedUntil > new Date() ? u.communityMutedUntil : null;
}

async function assertCanPost(user: SessionUser) {
  assertParticipant(user);
  const until = await mutedUntil(user.id);
  if (until) throw new MutedError(until);
}

// ───────────────────────── Listagem ─────────────────────────

export const threadFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  course: z.string().max(40).optional().catch(undefined),
  type: z.enum(["QUESTION", "DISCUSSION"]).optional().catch(undefined),
  sort: z.enum(["recent", "popular", "unanswered"]).optional().catch(undefined),
  status: z.enum(["unanswered", "solved"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});
export type ThreadFilters = z.infer<typeof threadFiltersSchema>;

const authorSelect = { id: true, name: true, avatarUrl: true, roles: { select: { role: { select: { key: true } } } } } satisfies Prisma.UserSelect;

export const THREADS_PAGE_SIZE = 20;

export async function listThreads(user: SessionUser, raw: Record<string, unknown>) {
  assertParticipant(user);
  const f = threadFiltersSchema.parse(raw);
  const where: Prisma.DiscussionThreadWhereInput = {
    deletedAt: null,
    ...(f.type ? { type: f.type } : {}),
    ...(f.course ? { courseId: f.course } : {}),
    ...(f.q ? { OR: [{ title: { contains: f.q, mode: "insensitive" } }, { body: { contains: f.q, mode: "insensitive" } }] } : {}),
    ...(f.status === "solved" ? { solutionReplyId: { not: null } } : {}),
    ...(f.status === "unanswered" || f.sort === "unanswered" ? { replyCount: 0 } : {}),
  };
  const secondary: Prisma.DiscussionThreadOrderByWithRelationInput[] =
    f.sort === "popular" ? [{ likeCount: "desc" }, { replyCount: "desc" }, { viewCount: "desc" }] : [{ lastActivityAt: "desc" }];
  const page = f.page ?? 1;
  const [total, rows] = await Promise.all([
    db.discussionThread.count({ where }),
    db.discussionThread.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, ...secondary, { id: "desc" }],
      skip: (page - 1) * THREADS_PAGE_SIZE,
      take: THREADS_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        isPinned: true,
        isLocked: true,
        solutionReplyId: true,
        replyCount: true,
        likeCount: true,
        viewCount: true,
        lastActivityAt: true,
        createdAt: true,
        author: { select: authorSelect },
        course: { select: { id: true, title: true } },
        replies: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 3, select: { author: { select: { name: true, avatarUrl: true } } } },
      },
    }),
  ]);
  return { total, page, pageSize: THREADS_PAGE_SIZE, threads: rows, filters: f };
}

/** Cursos para filtro/seleção: os que o usuário cursa ou ensina + os que já têm discussões. */
export async function communityCourses(user: SessionUser) {
  return db.course.findMany({
    where: {
      OR: [
        { enrollments: { some: { userId: user.id, status: { not: "CANCELLED" } } } },
        { instructorId: user.id },
        { threads: { some: { deletedAt: null } } },
      ],
    },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take: 100,
  });
}

/** Cursos em que o usuário pode publicar (vínculo com o curso). */
async function postableCourseIds(user: SessionUser) {
  if (user.permissions.has("courses.manage_any") || canModerate(user)) return null; // qualquer curso
  const [enrolled, taught] = await Promise.all([
    db.enrollment.findMany({ where: { userId: user.id, status: { not: "CANCELLED" } }, select: { courseId: true } }),
    db.course.findMany({ where: { instructorId: user.id }, select: { id: true } }),
  ]);
  return new Set([...enrolled.map((e) => e.courseId), ...taught.map((c) => c.id)]);
}

export async function postableCourses(user: SessionUser) {
  const ids = await postableCourseIds(user);
  return db.course.findMany({
    where: ids === null ? { status: { in: ["PUBLISHED", "ARCHIVED"] } } : { id: { in: [...ids] } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}

// ───────────────────────── Thread ─────────────────────────

// Dedupe barato de visualizações (por usuário/thread, 30 min) em memória.
const viewCache = (globalThis as unknown as { __threadViews?: Map<string, number> }).__threadViews ?? new Map<string, number>();
(globalThis as unknown as { __threadViews?: Map<string, number> }).__threadViews = viewCache;

export async function registerView(userId: string, threadId: string) {
  const key = `${userId}:${threadId}`;
  const now = Date.now();
  const last = viewCache.get(key);
  if (last && now - last < 30 * 60_000) return;
  viewCache.set(key, now);
  if (viewCache.size > 20_000) for (const [k, t] of viewCache) if (now - t > 30 * 60_000) viewCache.delete(k);
  // UPDATE direto: não toca updatedAt nem carrega a linha.
  await db.$executeRaw`UPDATE discussion_threads SET "viewCount" = "viewCount" + 1 WHERE id = ${threadId} AND "deletedAt" IS NULL`;
}

export async function getThread(user: SessionUser, threadId: string) {
  assertParticipant(user);
  const thread = await db.discussionThread.findFirst({
    where: { id: threadId, deletedAt: null },
    include: {
      author: { select: { ...authorSelect, headline: true, communityMutedUntil: true } },
      course: { select: { id: true, title: true, slug: true } },
      lesson: { select: { id: true, title: true } },
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { ...authorSelect, headline: true, communityMutedUntil: true } } },
      },
    },
  });
  if (!thread) throw new NotFoundError("Esta discussão não existe ou foi removida.");
  const likes = await db.discussionLike.findMany({
    where: { userId: user.id, OR: [{ threadId }, { replyId: { in: thread.replies.map((r) => r.id) } }] },
    select: { threadId: true, replyId: true },
  });
  const likedReplies = new Set(likes.filter((l) => l.replyId).map((l) => l.replyId!));
  return {
    thread,
    likedThread: likes.some((l) => l.threadId === threadId),
    likedReplies,
    mutedUntil: await mutedUntil(user.id),
  };
}

// ───────────────────────── Criação ─────────────────────────

export const threadSchema = z.object({
  type: z.enum(["QUESTION", "DISCUSSION"]),
  title: z.string().trim().min(8, "Use um título com pelo menos 8 caracteres.").max(160, "Título muito longo (máx. 160)."),
  body: z.string().trim().min(15, "Descreva com um pouco mais de detalhe (mín. 15 caracteres).").max(20_000),
  courseId: z.string().max(40).nullish().transform((v) => v || null),
});

export async function createThread(user: SessionUser, input: unknown) {
  await assertCanPost(user);
  const data = parseInput(threadSchema, input);
  await rateLimit("community.thread", 5, 10 * 60_000, user.id);
  if (data.courseId) {
    const allowed = await postableCourseIds(user);
    if (allowed !== null && !allowed.has(data.courseId)) throw new ValidationError(undefined, { courseId: "Você só pode publicar em cursos dos quais participa." });
  }
  const thread = await db.discussionThread.create({
    data: { authorId: user.id, type: data.type, title: data.title, body: data.body, courseId: data.courseId },
    select: { id: true },
  });
  await awardXp(user.id, "thread_created", thread.id);
  return thread;
}

export const replySchema = z.object({
  threadId: z.string().min(1).max(40),
  body: z.string().trim().min(2, "Escreva sua resposta.").max(20_000),
});

export async function replyToThread(user: SessionUser, input: unknown) {
  await assertCanPost(user);
  const data = parseInput(replySchema, input);
  await rateLimit("community.reply", 20, 10 * 60_000, user.id);
  const thread = await db.discussionThread.findFirst({ where: { id: data.threadId, deletedAt: null }, select: { id: true, title: true, authorId: true, isLocked: true, type: true } });
  if (!thread) throw new NotFoundError("Esta discussão não existe ou foi removida.");
  if (thread.isLocked && !canModerate(user)) throw new ForbiddenError("Esta discussão foi trancada e não aceita novas respostas.");

  const now = new Date();
  const [reply] = await db.$transaction([
    db.discussionReply.create({ data: { threadId: thread.id, authorId: user.id, body: data.body, createdAt: now }, select: { id: true } }),
    db.discussionThread.update({ where: { id: thread.id }, data: { replyCount: { increment: 1 }, lastActivityAt: now } }),
  ]);
  if (thread.authorId !== user.id) {
    await notify(thread.authorId, {
      type: "COMMUNITY",
      title: thread.type === "QUESTION" ? `${user.name} respondeu sua pergunta` : `${user.name} respondeu sua discussão`,
      body: thread.title,
      link: `/community/${thread.id}#r-${reply.id}`,
    });
  }
  return reply;
}

// ───────────────────────── Curtidas ─────────────────────────

export const likeSchema = z.union([
  z.object({ threadId: z.string().min(1).max(40), replyId: z.undefined().optional() }),
  z.object({ replyId: z.string().min(1).max(40), threadId: z.undefined().optional() }),
]);

/** Alterna a curtida e devolve o estado final com o contador recalculado. */
export async function toggleLike(user: SessionUser, input: unknown): Promise<{ liked: boolean; count: number }> {
  assertParticipant(user);
  const data = parseInput(likeSchema, input);
  await rateLimit("community.like", 120, 60_000, user.id);

  if (data.threadId) {
    const t = await db.discussionThread.findFirst({ where: { id: data.threadId, deletedAt: null }, select: { id: true } });
    if (!t) throw new NotFoundError("Discussão não encontrada.");
  } else {
    const r = await db.discussionReply.findFirst({ where: { id: data.replyId!, deletedAt: null, thread: { deletedAt: null } }, select: { id: true } });
    if (!r) throw new NotFoundError("Resposta não encontrada.");
  }

  const key = data.threadId ? { userId: user.id, threadId: data.threadId } : { userId: user.id, replyId: data.replyId! };
  return db.$transaction(async (tx) => {
    // deleteMany/createMany(skipDuplicates) evitam erros de corrida (duplo clique).
    const removed = await tx.discussionLike.deleteMany({ where: key });
    const liked = removed.count === 0;
    const delta = liked ? (await tx.discussionLike.createMany({ data: [key], skipDuplicates: true })).count : -removed.count;
    // O contador acompanha a tabela de curtidas; GREATEST preserva curtidas
    // "legadas" sem linha (dados importados) e impede valores negativos.
    if (data.threadId) {
      const n = await tx.discussionLike.count({ where: { threadId: data.threadId } });
      const t = await tx.discussionThread.update({ where: { id: data.threadId }, data: { likeCount: { increment: delta } }, select: { likeCount: true } });
      const count = Math.max(n, t.likeCount, 0);
      if (count !== t.likeCount) await tx.discussionThread.update({ where: { id: data.threadId }, data: { likeCount: count } });
      return { liked, count };
    }
    const n = await tx.discussionLike.count({ where: { replyId: data.replyId! } });
    const r = await tx.discussionReply.update({ where: { id: data.replyId! }, data: { likeCount: { increment: delta } }, select: { likeCount: true } });
    const count = Math.max(n, r.likeCount, 0);
    if (count !== r.likeCount) await tx.discussionReply.update({ where: { id: data.replyId! }, data: { likeCount: count } });
    return { liked, count };
  });
}

// ───────────────────────── Solução ─────────────────────────

export const solutionSchema = z.object({ threadId: z.string().min(1).max(40), replyId: z.string().max(40).nullable() });

export async function setSolution(user: SessionUser, input: unknown) {
  assertParticipant(user);
  const data = parseInput(solutionSchema, input);
  const thread = await db.discussionThread.findFirst({ where: { id: data.threadId, deletedAt: null }, select: { id: true, title: true, authorId: true, type: true, solutionReplyId: true } });
  if (!thread) throw new NotFoundError("Discussão não encontrada.");
  if (thread.authorId !== user.id && !canModerate(user)) throw new ForbiddenError("Só o autor da pergunta ou um moderador pode escolher a solução.");
  if (thread.type !== "QUESTION") throw new ValidationError("Apenas perguntas têm resposta aceita.");

  if (data.replyId === null) {
    await db.discussionThread.update({ where: { id: thread.id }, data: { solutionReplyId: null } });
    if (thread.authorId !== user.id) await audit("community.solution_cleared", { actorId: user.id, entityType: "thread", entityId: thread.id });
    return { solutionReplyId: null };
  }
  const reply = await db.discussionReply.findFirst({ where: { id: data.replyId, threadId: thread.id, deletedAt: null }, select: { id: true, authorId: true } });
  if (!reply) throw new NotFoundError("Resposta não encontrada nesta pergunta.");
  await db.discussionThread.update({ where: { id: thread.id }, data: { solutionReplyId: reply.id } });

  if (reply.authorId !== thread.authorId) {
    await awardXp(reply.authorId, "reply_solution", reply.id); // idempotente por resposta
  }
  if (reply.authorId !== user.id) {
    await notify(reply.authorId, {
      type: "COMMUNITY",
      title: "Sua resposta foi marcada como solução",
      body: thread.title,
      link: `/community/${thread.id}#r-${reply.id}`,
    });
  }
  if (thread.authorId !== user.id) await audit("community.solution_set", { actorId: user.id, entityType: "thread", entityId: thread.id, metadata: { replyId: reply.id } });
  return { solutionReplyId: reply.id };
}

// ───────────────────────── Moderação ─────────────────────────

export const moderateThreadSchema = z.object({
  threadId: z.string().min(1).max(40),
  action: z.enum(["pin", "unpin", "lock", "unlock", "remove"]),
  reason: z.string().trim().max(300).optional(),
});

export async function moderateThread(user: SessionUser, input: unknown) {
  const data = parseInput(moderateThreadSchema, input);
  const thread = await db.discussionThread.findFirst({ where: { id: data.threadId, deletedAt: null }, select: { id: true, title: true, authorId: true } });
  if (!thread) throw new NotFoundError("Discussão não encontrada.");
  const own = thread.authorId === user.id;
  // O autor pode remover a própria discussão; o resto exige moderação.
  if (!canModerate(user) && !(own && data.action === "remove")) throw new ForbiddenError("Apenas moderadores podem fazer isso.");

  const patch: Prisma.DiscussionThreadUpdateInput =
    data.action === "pin" ? { isPinned: true }
    : data.action === "unpin" ? { isPinned: false }
    : data.action === "lock" ? { isLocked: true }
    : data.action === "unlock" ? { isLocked: false }
    : { deletedAt: new Date(), isPinned: false };
  await db.discussionThread.update({ where: { id: thread.id }, data: patch });
  await audit(`community.thread_${data.action}`, {
    actorId: user.id,
    entityType: "thread",
    entityId: thread.id,
    metadata: { title: thread.title, authorId: thread.authorId, reason: data.reason ?? null, byAuthor: own && !canModerate(user) },
  });
  if (data.action === "remove" && !own) {
    await notify(thread.authorId, {
      type: "COMMUNITY",
      title: "Sua discussão foi removida pela moderação",
      body: data.reason ? `“${thread.title}” — motivo: ${data.reason}` : `“${thread.title}” não segue as diretrizes da comunidade.`,
      link: "/community",
    });
  }
}

export const removeReplySchema = z.object({ replyId: z.string().min(1).max(40), reason: z.string().trim().max(300).optional() });

export async function removeReply(user: SessionUser, input: unknown) {
  const data = parseInput(removeReplySchema, input);
  const reply = await db.discussionReply.findFirst({
    where: { id: data.replyId, deletedAt: null },
    select: { id: true, authorId: true, threadId: true, thread: { select: { solutionReplyId: true, title: true } } },
  });
  if (!reply) throw new NotFoundError("Resposta não encontrada.");
  const own = reply.authorId === user.id;
  if (!own && !canModerate(user)) throw new ForbiddenError("Apenas moderadores podem remover respostas de outras pessoas.");
  await db.$transaction([
    db.discussionReply.update({ where: { id: reply.id }, data: { deletedAt: new Date() } }),
    db.discussionThread.update({
      where: { id: reply.threadId },
      data: { replyCount: { decrement: 1 }, ...(reply.thread.solutionReplyId === reply.id ? { solutionReplyId: null } : {}) },
    }),
  ]);
  // Evita contador negativo em dados inconsistentes.
  await db.discussionThread.updateMany({ where: { id: reply.threadId, replyCount: { lt: 0 } }, data: { replyCount: 0 } });
  await audit("community.reply_remove", { actorId: user.id, entityType: "reply", entityId: reply.id, metadata: { threadId: reply.threadId, authorId: reply.authorId, reason: data.reason ?? null, byAuthor: own } });
  if (!own) {
    await notify(reply.authorId, {
      type: "COMMUNITY",
      title: "Sua resposta foi removida pela moderação",
      body: data.reason ? `Em “${reply.thread.title}” — motivo: ${data.reason}` : `Em “${reply.thread.title}”.`,
      link: `/community/${reply.threadId}`,
    });
  }
  return { threadId: reply.threadId };
}

export const muteSchema = z.object({
  userId: z.string().min(1).max(40),
  days: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7), z.literal(30), z.literal(365)]),
  reason: z.string().trim().max(300).optional(),
});

/** Silencia (days > 0) ou libera (days = 0) um usuário na comunidade. Exige `users.manage`. */
export async function setCommunityMute(user: SessionUser, input: unknown) {
  if (!user.permissions.has("users.manage")) throw new ForbiddenError("Apenas administradores podem silenciar usuários.");
  const data = parseInput(muteSchema, input);
  if (data.userId === user.id) throw new ValidationError("Você não pode silenciar a própria conta.");
  const target = await db.user.findUnique({ where: { id: data.userId }, select: { id: true, name: true } });
  if (!target) throw new NotFoundError("Usuário não encontrado.");
  const until = data.days ? new Date(Date.now() + data.days * 86_400_000) : null;
  await db.user.update({ where: { id: target.id }, data: { communityMutedUntil: until } });
  await audit(until ? "community.user_muted" : "community.user_unmuted", {
    actorId: user.id,
    entityType: "user",
    entityId: target.id,
    metadata: { days: data.days, until: until?.toISOString() ?? null, reason: data.reason ?? null },
  });
  await notify(target.id, until
    ? { type: "SYSTEM", title: "Participação na comunidade suspensa", body: `Você poderá voltar a publicar em ${formatDateTime(until)}.${data.reason ? ` Motivo: ${data.reason}` : ""}`, link: "/community" }
    : { type: "SYSTEM", title: "Participação na comunidade liberada", body: "Você já pode voltar a publicar e responder.", link: "/community" });
  return { until: until?.toISOString() ?? null, name: target.name };
}
