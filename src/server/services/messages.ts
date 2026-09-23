import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { parseInput } from "@/server/action";
import type { SessionUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { getSettings } from "@/server/settings";
import { fileUrl } from "@/server/storage";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { notify } from "./notifications";

/**
 * Mensagens diretas e suporte.
 *
 * Regras de acesso (verificadas SEMPRE aqui, nunca na UI):
 *  - Só participantes leem ou escrevem numa conversa. Qualquer consulta filtra
 *    por `participants.some.userId = usuário` — conversas alheias viram 404.
 *  - Iniciar conversa direta:
 *      gestão/admin (users.manage | support.respond | students.view_all) → qualquer usuário ativo;
 *      professor (courses.manage_own) → alunos dos seus cursos e equipe de gestão;
 *      aluno → professores dos cursos em que está matriculado.
 *  - Suporte (ConversationType SUPPORT): o solicitante + todos os usuários com
 *    `support.respond` entram como participantes (caixa compartilhada).
 */

// ───────────────────────── DTOs ─────────────────────────

export type ParticipantDTO = { id: string; name: string; avatarUrl: string | null; headline: string | null; roleLabel: string };
export type AttachmentDTO = { id: string; name: string; mimeType: string; sizeBytes: number; url: string };
export type MessageDTO = { id: string; senderId: string; body: string; createdAt: string; attachment: AttachmentDTO | null };
export type ConversationSummary = {
  id: string;
  type: "DIRECT" | "SUPPORT";
  title: string;
  subtitle: string | null;
  avatar: { name: string; avatarUrl: string | null };
  others: ParticipantDTO[];
  last: { body: string; senderId: string; mine: boolean; hasAttachment: boolean } | null;
  lastMessageAt: string;
  unread: number;
};
export type ConversationDetail = ConversationSummary & {
  messages: MessageDTO[];
  hasMore: boolean;
  othersLastReadAt: string | null;
  canSend: boolean;
};
export type ContactDTO = { id: string; name: string; avatarUrl: string | null; context: string };

const ROLE_ORDER: RoleKey[] = ["admin", "manager", "teacher", "student"];
const STAFF_ROLES: RoleKey[] = ["admin", "manager"];

const userSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  headline: true,
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserSelect;
type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function roleKeys(u: UserRow) {
  return u.roles.map((r) => r.role.key as RoleKey);
}
function roleLabel(u: UserRow) {
  const keys = roleKeys(u);
  return ROLE_LABELS[ROLE_ORDER.find((r) => keys.includes(r)) ?? "student"];
}
function toParticipant(u: UserRow): ParticipantDTO {
  return { id: u.id, name: u.name, avatarUrl: u.avatarUrl, headline: u.headline, roleLabel: roleLabel(u) };
}

const messageSelect = {
  id: true,
  senderId: true,
  body: true,
  createdAt: true,
  deletedAt: true,
  attachment: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
} satisfies Prisma.MessageSelect;
type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

function toMessage(m: MessageRow): MessageDTO {
  return {
    id: m.id,
    senderId: m.senderId,
    body: m.deletedAt ? "" : m.body,
    createdAt: m.createdAt.toISOString(),
    attachment:
      m.attachment && !m.deletedAt
        ? { id: m.attachment.id, name: m.attachment.originalName, mimeType: m.attachment.mimeType, sizeBytes: m.attachment.sizeBytes, url: fileUrl(m.attachment.id) }
        : null,
  };
}

const conversationInclude = {
  participants: { select: { userId: true, joinedAt: true, lastReadAt: true, user: { select: userSelect } } },
  messages: { take: 1, orderBy: { createdAt: "desc" }, where: { deletedAt: null }, select: { body: true, senderId: true, attachmentId: true } },
  course: { select: { title: true } },
} satisfies Prisma.ConversationInclude;
type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

/** Em SUPPORT, o solicitante é quem entrou primeiro (em empate, quem não é da equipe). */
function supportRequester(c: ConversationRow) {
  return [...c.participants].sort((a, b) => {
    const t = a.joinedAt.getTime() - b.joinedAt.getTime();
    if (t !== 0) return t;
    const staff = (p: (typeof c.participants)[number]) => (roleKeys(p.user).some((r) => STAFF_ROLES.includes(r)) ? 1 : 0);
    return staff(a) - staff(b);
  })[0];
}

function summarize(c: ConversationRow, userId: string, unread: number): ConversationSummary {
  const others = c.participants.filter((p) => p.userId !== userId).map((p) => toParticipant(p.user));
  let title: string;
  let subtitle: string | null = c.course?.title ?? null;
  let avatar = { name: others[0]?.name ?? "Conversa", avatarUrl: others[0]?.avatarUrl ?? null };
  if (c.type === "SUPPORT") {
    const requester = supportRequester(c);
    if (requester?.userId === userId) {
      title = "Suporte da Escola";
      avatar = { name: "Suporte", avatarUrl: null };
    } else {
      title = requester?.user.name ?? "Solicitação de suporte";
      avatar = { name: title, avatarUrl: requester?.user.avatarUrl ?? null };
    }
    subtitle = c.subject && c.subject !== "Suporte" ? `Suporte · ${c.subject}` : "Suporte";
  } else {
    title = others.map((o) => o.name).join(", ") || "Somente você";
  }
  const last = c.messages[0];
  return {
    id: c.id,
    type: c.type,
    title,
    subtitle,
    avatar,
    others,
    last: last ? { body: last.body.slice(0, 160), senderId: last.senderId, mine: last.senderId === userId, hasAttachment: !!last.attachmentId } : null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unread,
  };
}

async function unreadByConversation(userId: string, conversationIds?: string[]) {
  const rows = await db.$queryRaw<{ conversationId: string; n: bigint }[]>`
    SELECT m."conversationId", COUNT(*)::bigint AS n
    FROM messages m
    JOIN conversation_participants p ON p."conversationId" = m."conversationId" AND p."userId" = ${userId}
    WHERE m."senderId" <> ${userId} AND m."deletedAt" IS NULL
      AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
    GROUP BY m."conversationId"`;
  const map = new Map(rows.map((r) => [r.conversationId, Number(r.n)]));
  if (conversationIds) for (const id of [...map.keys()]) if (!conversationIds.includes(id)) map.delete(id);
  return map;
}

function assertCanMessage(user: SessionUser) {
  if (!user.permissions.has("messages.send") && !user.permissions.has("support.respond")) {
    throw new ForbiddenError("Seu perfil não pode enviar mensagens.");
  }
}

// ───────────────────────── Leitura ─────────────────────────

export async function listConversations(user: SessionUser): Promise<ConversationSummary[]> {
  const [rows, unread] = await Promise.all([
    db.conversation.findMany({
      where: { participants: { some: { userId: user.id } } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: conversationInclude,
    }),
    unreadByConversation(user.id),
  ]);
  return rows.map((c) => summarize(c, user.id, unread.get(c.id) ?? 0));
}

async function findMine(user: SessionUser, conversationId: string) {
  const c = await db.conversation.findFirst({
    where: { id: conversationId, participants: { some: { userId: user.id } } },
    include: conversationInclude,
  });
  if (!c) throw new NotFoundError("Conversa não encontrada.");
  return c;
}

function othersLastRead(c: ConversationRow, userId: string) {
  const times = c.participants.filter((p) => p.userId !== userId && p.lastReadAt).map((p) => p.lastReadAt!.getTime());
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

const PAGE = 50;

export async function getConversation(user: SessionUser, conversationId: string): Promise<ConversationDetail> {
  const c = await findMine(user, conversationId);
  const rows = await db.message.findMany({
    where: { conversationId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    select: messageSelect,
  });
  const hasMore = rows.length > PAGE;
  const unread = (await unreadByConversation(user.id, [c.id])).get(c.id) ?? 0;
  return {
    ...summarize(c, user.id, unread),
    messages: rows.slice(0, PAGE).reverse().map(toMessage),
    hasMore,
    othersLastReadAt: othersLastRead(c, user.id),
    canSend: user.permissions.has("messages.send") || user.permissions.has("support.respond"),
  };
}

export async function loadOlderMessages(user: SessionUser, conversationId: string, beforeId: string) {
  await findMine(user, conversationId);
  const before = await db.message.findFirst({ where: { id: beforeId, conversationId }, select: { createdAt: true } });
  if (!before) throw new NotFoundError("Mensagem não encontrada.");
  const rows = await db.message.findMany({
    where: { conversationId, deletedAt: null, createdAt: { lt: before.createdAt } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    select: messageSelect,
  });
  return { messages: rows.slice(0, PAGE).reverse().map(toMessage), hasMore: rows.length > PAGE };
}

/**
 * Polling leve: devolve só as mensagens posteriores à última que o cliente
 * conhece (cursor por data da mensagem `afterId`) e o estado de leitura dos outros.
 */
export async function pollConversation(user: SessionUser, conversationId: string, afterId: string | null, markAsRead: boolean) {
  const c = await findMine(user, conversationId);
  let since: Date | null = null;
  if (afterId) {
    const after = await db.message.findFirst({ where: { id: afterId, conversationId }, select: { createdAt: true } });
    since = after?.createdAt ?? null;
  }
  const rows = await db.message.findMany({
    where: { conversationId, deletedAt: null, ...(since ? { createdAt: { gte: since }, id: { not: afterId! } } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: messageSelect,
  });
  if (markAsRead && rows.some((m) => m.senderId !== user.id)) await markConversationRead(user, conversationId);
  return { messages: rows.map(toMessage), othersLastReadAt: othersLastRead(c, user.id) };
}

export async function markConversationRead(user: SessionUser, conversationId: string) {
  const res = await db.conversationParticipant.updateMany({
    where: { conversationId, userId: user.id },
    data: { lastReadAt: new Date() },
  });
  if (!res.count) throw new NotFoundError("Conversa não encontrada.");
  // Abrir a conversa também "apaga" o aviso correspondente no sino.
  await db.notification.updateMany({
    where: { userId: user.id, type: "MESSAGE", readAt: null, link: `/messages/${conversationId}` },
    data: { readAt: new Date() },
  });
}

// ───────────────────────── Envio ─────────────────────────

export const sendMessageSchema = z
  .object({
    conversationId: z.string().min(1).max(40),
    body: z.string().max(4000, "Mensagem muito longa (máx. 4.000 caracteres).").default(""),
    attachmentId: z.string().max(40).nullish(),
  })
  .transform((v) => ({ ...v, body: v.body.replace(/\r\n/g, "\n").trim() }))
  .refine((v) => v.body.length > 0 || !!v.attachmentId, { message: "Escreva uma mensagem ou anexe um arquivo.", path: ["body"] });

function snippet(body: string, hasAttachment: boolean) {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return hasAttachment ? "Enviou um anexo" : "";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/**
 * Avisa os demais participantes sem spam: se já existe um aviso não lido desta
 * conversa, ele é atualizado (texto e horário) em vez de criar outro.
 */
async function notifyParticipants(senderName: string, conversationId: string, recipientIds: string[], body: string, title?: string) {
  if (!recipientIds.length) return;
  const link = `/messages/${conversationId}`;
  const existing = await db.notification.findMany({
    where: { userId: { in: recipientIds }, type: "MESSAGE", readAt: null, link },
    select: { id: true, userId: true },
  });
  if (existing.length) {
    await db.notification.updateMany({
      where: { id: { in: existing.map((e) => e.id) } },
      data: { title: title ?? `Novas mensagens de ${senderName}`, body, createdAt: new Date() },
    });
  }
  const have = new Set(existing.map((e) => e.userId));
  await notify(
    recipientIds.filter((id) => !have.has(id)),
    { type: "MESSAGE", title: title ?? `Nova mensagem de ${senderName}`, body, link },
  );
}

export async function sendMessage(user: SessionUser, input: unknown): Promise<MessageDTO> {
  assertCanMessage(user);
  const data = parseInput(sendMessageSchema, input);
  await rateLimit("messages.send", 30, 60_000, user.id);
  const c = await findMine(user, data.conversationId);

  if (data.attachmentId) {
    const file = await db.fileAsset.findUnique({ where: { id: data.attachmentId }, select: { ownerId: true, storageKey: true } });
    if (!file || file.ownerId !== user.id || !file.storageKey.startsWith("attachment/")) {
      throw new ValidationError("Anexo inválido. Envie o arquivo novamente.");
    }
  }

  const now = new Date();
  const [message] = await db.$transaction([
    db.message.create({
      data: { conversationId: c.id, senderId: user.id, body: data.body, attachmentId: data.attachmentId ?? null, createdAt: now },
      select: messageSelect,
    }),
    db.conversation.update({ where: { id: c.id }, data: { lastMessageAt: now } }),
    db.conversationParticipant.update({ where: { conversationId_userId: { conversationId: c.id, userId: user.id } }, data: { lastReadAt: now } }),
  ]);

  // Quem está com a conversa aberta (leu nos últimos 20 s via polling) não precisa de aviso.
  const activeSince = now.getTime() - 20_000;
  const recipients = c.participants
    .filter((p) => p.userId !== user.id && !(p.lastReadAt && p.lastReadAt.getTime() > activeSince))
    .map((p) => p.userId);
  const title = c.type === "SUPPORT" && supportRequester(c)?.userId !== user.id ? "Resposta do suporte" : undefined;
  await notifyParticipants(user.name, c.id, recipients, snippet(data.body, !!data.attachmentId), title);
  return toMessage(message);
}

// ───────────────────────── Nova conversa ─────────────────────────

function isManagement(user: SessionUser) {
  return ["users.manage", "support.respond", "students.view_all"].some((p) => user.permissions.has(p as never));
}

/** Pode iniciar uma conversa direta com `targetId`? Retorna o curso em comum (contexto) quando houver. */
async function directScope(user: SessionUser, targetId: string): Promise<{ allowed: boolean; courseId: string | null }> {
  if (targetId === user.id) return { allowed: false, courseId: null };
  const target = await db.user.findUnique({ where: { id: targetId }, select: { status: true, roles: { select: { role: { select: { key: true } } } } } });
  if (!target || target.status !== "ACTIVE") return { allowed: false, courseId: null };

  // Curso em comum: alvo ensina um curso em que estou matriculado, ou vice-versa.
  const common = await db.course.findFirst({
    where: {
      OR: [
        { instructorId: targetId, enrollments: { some: { userId: user.id, status: { not: "CANCELLED" } } } },
        { instructorId: user.id, enrollments: { some: { userId: targetId, status: { not: "CANCELLED" } } } },
      ],
    },
    select: { id: true, instructorId: true },
  });

  if (isManagement(user)) return { allowed: true, courseId: common?.id ?? null };
  const teacher = user.permissions.has("courses.manage_own");
  const targetIsStaff = target.roles.some((r) => STAFF_ROLES.includes(r.role.key as RoleKey));
  if (teacher && targetIsStaff) return { allowed: true, courseId: null };
  if (common) {
    // Professor → aluno do próprio curso; aluno → professor do curso matriculado.
    if (common.instructorId === user.id && teacher) return { allowed: true, courseId: common.id };
    if (common.instructorId === targetId) return { allowed: true, courseId: common.id };
  }
  return { allowed: false, courseId: null };
}

/** Abre (ou cria) a conversa direta com `targetId`. Usado por ?to=<userId>. */
export async function openDirectConversation(user: SessionUser, targetId: string) {
  assertCanMessage(user);
  const id = z.string().min(1).max(40).parse(targetId);
  const existing = await db.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: id } } },
        { participants: { every: { userId: { in: [user.id, id] } } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const scope = await directScope(user, id);
  if (!scope.allowed) throw new ForbiddenError("Você não pode iniciar uma conversa com esta pessoa.");
  await rateLimit("messages.new", 20, 60 * 60_000, user.id);
  const c = await db.conversation.create({
    data: { type: "DIRECT", courseId: scope.courseId, participants: { create: [{ userId: user.id, lastReadAt: new Date() }, { userId: id }] } },
    select: { id: true },
  });
  return c.id;
}

async function supportStaffIds(excludeId: string) {
  const staff = await db.user.findMany({
    where: {
      status: "ACTIVE",
      id: { not: excludeId },
      roles: { some: { role: { permissions: { some: { permission: { key: "support.respond" } } } } } },
    },
    select: { id: true },
    take: 25,
  });
  return staff.map((s) => s.id);
}

export const supportSchema = z.object({
  subject: z.string().trim().min(3, "Descreva o assunto em poucas palavras.").max(120),
  body: z.string().trim().min(5, "Conte com mais detalhes como podemos ajudar.").max(4000),
});

export async function openSupportConversation(user: SessionUser, input: unknown) {
  if (!user.permissions.has("messages.send")) throw new ForbiddenError();
  const data = parseInput(supportSchema, input);
  const settings = await getSettings("communication");
  if (!settings.supportEnabled) throw new ValidationError("O atendimento por mensagens está desativado no momento.");
  await rateLimit("messages.support", 5, 60 * 60_000, user.id);
  const staff = await supportStaffIds(user.id);
  if (!staff.length) throw new ValidationError("Nenhum atendente disponível agora. Tente novamente mais tarde.");

  const now = new Date();
  const later = new Date(now.getTime() + 1000); // garante o solicitante como primeiro participante
  const c = await db.conversation.create({
    data: {
      type: "SUPPORT",
      subject: data.subject,
      lastMessageAt: now,
      participants: { create: [{ userId: user.id, joinedAt: now, lastReadAt: now }, ...staff.map((userId) => ({ userId, joinedAt: later }))] },
      messages: { create: { senderId: user.id, body: data.body, createdAt: now } },
    },
    select: { id: true },
  });
  await notify(staff, { type: "MESSAGE", title: `Suporte: ${data.subject}`, body: `${user.name}: ${snippet(data.body, false)}`, link: `/messages/${c.id}` });
  return c.id;
}

/** Pessoas com quem o usuário pode iniciar conversa (para o seletor "Nova conversa"). */
export async function listContacts(user: SessionUser, q = ""): Promise<ContactDTO[]> {
  const term = q.trim().slice(0, 80);
  const nameFilter: Prisma.UserWhereInput = term
    ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] }
    : {};
  const base: Prisma.UserWhereInput = { status: "ACTIVE", id: { not: user.id }, ...nameFilter };
  const select = { ...userSelect, taughtCourses: { select: { title: true }, take: 1 } } satisfies Prisma.UserSelect;

  const describe = (u: Prisma.UserGetPayload<{ select: typeof select }>, fallback?: string) =>
    fallback ?? (u.headline ? `${roleLabel(u)} · ${u.headline}` : roleLabel(u));

  if (isManagement(user)) {
    const rows = await db.user.findMany({ where: base, select, orderBy: { name: "asc" }, take: 30 });
    return rows.map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl, context: describe(u) }));
  }

  const out = new Map<string, ContactDTO>();
  // Professores dos cursos em que estou matriculado.
  const teachers = await db.course.findMany({
    where: { enrollments: { some: { userId: user.id, status: { not: "CANCELLED" } } }, instructorId: { not: user.id }, instructor: base },
    select: { title: true, instructor: { select } },
    take: 50,
  });
  for (const c of teachers) {
    if (!out.has(c.instructor.id)) out.set(c.instructor.id, { id: c.instructor.id, name: c.instructor.name, avatarUrl: c.instructor.avatarUrl, context: `Professor · ${c.title}` });
  }

  if (user.permissions.has("courses.manage_own")) {
    const staff = await db.user.findMany({ where: { ...base, roles: { some: { role: { key: { in: STAFF_ROLES } } } } }, select, take: 20 });
    for (const u of staff) out.set(u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl, context: `Gestão · ${roleLabel(u)}` });
    const students = await db.enrollment.findMany({
      where: { course: { instructorId: user.id }, status: { not: "CANCELLED" }, user: base },
      select: { course: { select: { title: true } }, user: { select } },
      orderBy: { user: { name: "asc" } },
      take: 60,
    });
    for (const e of students) if (!out.has(e.user.id)) out.set(e.user.id, { id: e.user.id, name: e.user.name, avatarUrl: e.user.avatarUrl, context: `Aluno · ${e.course.title}` });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).slice(0, 40);
}

export async function supportAvailable() {
  const s = await getSettings("communication");
  return s.supportEnabled;
}
