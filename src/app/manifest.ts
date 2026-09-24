// Revalida para refletir mudanças de marca feitas no admin.
export const revalidate = 3600;

import type { MetadataRoute } from "next";
import { getSettings } from "@/server/settings";

/** Manifesto PWA — base para instalação e futuro app mobile. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [general, appearance] = await Promise.all([getSettings("general"), getSettings("appearance")]);
  return {
    name: general.platformName,
    short_name: general.shortName,
    description: general.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: appearance.primaryColor,
    lang: "pt-BR",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
