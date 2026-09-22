import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@/components/analytics";
import { getSettings } from "@/server/settings";
import { env } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  const general = await getSettings("general");
  return {
    metadataBase: new URL(env.APP_URL),
    title: { default: `${general.platformName} — ${general.tagline}`, template: `%s · ${general.platformName}` },
    description: general.description,
    applicationName: general.platformName,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: general.platformName,
      title: general.platformName,
      description: general.description,
    },
    twitter: { card: "summary_large_image" },
    appleWebApp: { capable: true, title: general.shortName, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e0d" },
  ],
  width: "device-width",
  initialScale: 1,
};

function isHex(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [appearance, integrations] = await Promise.all([getSettings("appearance"), getSettings("integrations")]);
  // Valores validados por regex antes de entrar no CSS (evita injeção de estilo).
  const brand = isHex(appearance.primaryColor) ? appearance.primaryColor : "#1f5b4b";
  const accent = isHex(appearance.accentColor) ? appearance.accentColor : "#b7832f";
  const display = appearance.headingFont === "sans" ? "var(--font-sans)" : `"Fraunces Variable", ui-serif, Georgia, serif`;
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <style>{`:root{--brand:${brand};--brand-accent:${accent};--font-display-family:${display}}`}</style>
      </head>
      <body className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only z-[100] rounded-md bg-fg px-3 py-2 text-sm text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <Providers defaultTheme={appearance.defaultTheme}>{children}</Providers>
        <Analytics gaId={integrations.gaMeasurementId} pixelId={integrations.metaPixelId} />
      </body>
    </html>
  );
}
