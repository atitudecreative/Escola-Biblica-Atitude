import "server-only";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import type { FavoriteType } from "@prisma/client";

export async function toggleFavorite(userId: string, type: FavoriteType, id: string) {
  const key = type === "COURSE" ? "courseId" : type === "LESSON" ? "lessonId" : "materialId";
  const exists = await db.favorite.findFirst({ where: { userId, [key]: id } });
  if (exists) {
    await db.favorite.delete({ where: { id: exists.id } });
    return false;
  }
  const target =
    type === "COURSE"
      ? await db.course.findUnique({ where: { id }, select: { id: true } })
      : type === "LESSON"
        ? await db.lesson.findUnique({ where: { id }, select: { id: true } })
        : await db.material.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw new NotFoundError();
  await db.favorite.create({ data: { userId, type, [key]: id } });
  return true;
}

export async function listFavorites(userId: string) {
  return db.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { id: true, slug: true, title: true, subtitle: true, coverUrl: true, level: true, durationMinutes: true, ratingAvg: true, ratingCount: true, enrollmentCount: true, status: true, category: { select: { name: true, position: true } }, instructor: { select: { name: true } } } },
      lesson: { select: { id: true, title: true, type: true, durationSeconds: true, courseId: true, course: { select: { title: true, slug: true } } } },
      material: { select: { id: true, title: true, kind: true, url: true, lessonId: true, course: { select: { title: true, slug: true } }, file: { select: { id: true, mimeType: true, sizeBytes: true } } } },
    },
  });
}
