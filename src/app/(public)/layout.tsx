import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [general, footer, user] = await Promise.all([getSettings("general"), getSettings("footer"), getSessionUser()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader brand={{ name: general.platformName, logoUrl: general.logoUrl }} user={user ? { name: user.name, avatarUrl: user.avatarUrl } : null} />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <PublicFooter
        brand={{ name: general.platformName, logoUrl: general.logoUrl, tagline: general.tagline }}
        footer={footer}
        email={general.contactEmail}
        phone={general.contactPhone}
      />
    </div>
  );
}
