import "server-only";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";

export async function unreadConversations(userId: string) {
  const parts = await db.conversationParticipant.findMany({
    where: { userId },
    select: { lastReadAt: true, conversation: { select: { lastMessageAt: true, messages: { take: 1, orderBy: { createdAt: "desc" }, select: { senderId: true } } } } },
  });
  return parts.filter(
    (p) =>
      p.conversation.messages[0] &&
      p.conversation.messages[0].senderId !== userId &&
      (!p.lastReadAt || p.lastReadAt < p.conversation.lastMessageAt),
  ).length;
}

export async function pendingGradingCount(user: SessionUser) {
  if (!user.permissions.has("grading.own")) return 0;
  const scope = user.permissions.has("courses.manage_any") ? {} : { course: { instructorId: user.id } };
  const [subs, attempts] = await Promise.all([
    db.assignmentSubmission.count({ where: { status: { in: ["SUBMITTED", "GRADING"] }, assignment: scope } }),
    db.quizAttempt.count({ where: { status: "PENDING_REVIEW", quiz: scope } }),
  ]);
  return subs + attempts;
}

export async function shellCounts(user: SessionUser) {
  const [notifications, messages, grading] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    unreadConversations(user.id),
    pendingGradingCount(user),
  ]);
  return { notifications, messages, grading };
}

/** Rótulo do perfil "mais alto" para exibição. */
export function primaryRoleLabel(roles: RoleKey[]) {
  const order: RoleKey[] = ["admin", "manager", "teacher", "student"];
  const top = order.find((r) => roles.includes(r)) ?? "student";
  return ROLE_LABELS[top];
}
