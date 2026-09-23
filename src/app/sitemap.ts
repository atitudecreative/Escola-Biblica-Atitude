import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { env } from "@/server/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;
  const [courses, teachers, categories] = await Promise.all([
    db.course.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    db.user.findMany({ where: { status: "ACTIVE", taughtCourses: { some: { status: "PUBLISHED" } } }, select: { id: true, updatedAt: true } }),
    db.category.findMany({ select: { slug: true } }),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/courses`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/certificate`, changeFrequency: "yearly", priority: 0.3 },
    ...categories.map((c) => ({ url: `${base}/courses?category=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...courses.map((c) => ({ url: `${base}/courses/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...teachers.map((t) => ({ url: `${base}/teachers/${t.id}`, lastModified: t.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
