import "server-only";
import { db } from "@/server/db";
import { notify } from "./notifications";
import { logger } from "@/server/logger";

/**
 * Gamificação: XP como livro-razão (xp_events) e conquistas com regras
 * declarativas (achievements.criteria). Preparado para ranking, streaks e
 * desafios — basta adicionar novos tipos de critério em `metricFor`.
 */
export const XP = {
  lesson_completed: 10,
  quiz_passed: 25,
  assignment_approved: 30,
  course_completed: 100,
  thread_created: 5,
  reply_solution: 20,
} as const;

export type XpReason = keyof typeof XP;

/** Idempotente: o mesmo (motivo, referência) só pontua uma vez. */
export async function awardXp(userId: string, reason: XpReason, refId: string) {
  try {
    await db.$transaction([
      db.xpEvent.create({ data: { userId, reason, refId, amount: XP[reason] } }),
      db.user.update({ where: { id: userId }, data: { xp: { increment: XP[reason] } } }),
    ]);
    await evaluateAchievements(userId);
  } catch (e: unknown) {
    if ((e as { code?: string }).code !== "P2002") logger.error("xp.award_failed", { error: e, category: "app" });
  }
}

/** Nível a partir do XP — curva suave (nível n exige 50·n·(n+1) XP). */
export function levelFromXp(xp: number) {
  let level = 1;
  while (50 * level * (level + 1) <= xp) level++;
  const floor = 50 * (level - 1) * level;
  const ceil = 50 * level * (level + 1);
  return { level, progress: Math.round(((xp - floor) / (ceil - floor)) * 100), nextAt: ceil };
}

type Criteria = { metric: "lessons_completed" | "courses_completed" | "quizzes_passed" | "streak_days" | "threads_created" | "solutions"; count: number };

async function metricFor(userId: string, metric: Criteria["metric"]) {
  switch (metric) {
    case "lessons_completed":
      return db.lessonProgress.count({ where: { userId, status: "COMPLETED" } });
    case "courses_completed":
      return db.enrollment.count({ where: { userId, status: "COMPLETED" } });
    case "quizzes_passed":
      return db.xpEvent.count({ where: { userId, reason: "quiz_passed" } });
    case "threads_created":
      return db.discussionThread.count({ where: { authorId: userId, deletedAt: null } });
    case "solutions":
      return db.xpEvent.count({ where: { userId, reason: "reply_solution" } });
    case "streak_days":
      return currentStreak(userId);
  }
}

export async function currentStreak(userId: string) {
  const days = await db.userActivityDay.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 60, select: { date: true } });
  if (!days.length) return 0;
  const DAY = 86_400_000;
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  let expected = days[0].date.getTime() >= today - DAY ? days[0].date.getTime() : -1;
  if (expected < 0) return 0;
  let streak = 0;
  for (const d of days) {
    if (d.date.getTime() === expected) {
      streak++;
      expected -= DAY;
    } else break;
  }
  return streak;
}

export async function evaluateAchievements(userId: string) {
  const [all, owned] = await Promise.all([
    db.achievement.findMany({ where: { isActive: true } }),
    db.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);
  const have = new Set(owned.map((o) => o.achievementId));
  const cache = new Map<string, number>();
  for (const a of all) {
    if (have.has(a.id)) continue;
    const c = a.criteria as Criteria;
    if (!c?.metric) continue;
    if (!cache.has(c.metric)) cache.set(c.metric, await metricFor(userId, c.metric));
    if ((cache.get(c.metric) ?? 0) >= c.count) {
      await db.userAchievement.create({ data: { userId, achievementId: a.id } }).catch(() => undefined);
      if (a.xp) await db.user.update({ where: { id: userId }, data: { xp: { increment: a.xp } } });
      await notify(userId, { type: "ACHIEVEMENT", title: `Conquista desbloqueada: ${a.name}`, body: a.description, link: "/profile#conquistas" });
    }
  }
}
