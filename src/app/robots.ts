import type { MetadataRoute } from "next";
import { env } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/courses", "/teachers", "/certificate"],
        disallow: ["/api/", "/dashboard", "/learn/", "/admin", "/manager", "/teacher/", "/messages", "/profile", "/login", "/register", "/reset-password", "/verify-email"],
      },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
