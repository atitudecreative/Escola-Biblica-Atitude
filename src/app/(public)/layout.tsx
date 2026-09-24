import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { ACCOUNT_NAV, PUBLIC_NAV, SIDEBAR_COOKIE, filterNav } from "@/components/layout/nav-config";
import { PublicFooter } from "@/components/public/public-footer";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { primaryRoleLabel, shellCounts } from "@/server/services/shell";

/** Site público no mesmo shell da plataforma: visitante vê a navegação pública; logado, a sua. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [general, footer, user, jar] = await Promise.all([getSettings("general"), getSettings("footer"), getSessionUser(), cookies()]);
  const counts = user ? await shellCounts(user) : { messages: 0, notifications: 0, grading: 0 };
  return (
    <AppShell
      bare
      sections={user ? filterNav(user.permissions, user.roles) : PUBLIC_NAV}
      footerItems={user ? ACCOUNT_NAV : []}
      counts={counts}
      user={user ? { name: user.name, email: user.email, avatarUrl: user.avatarUrl, roleLabel: primaryRoleLabel(user.roles) } : null}
      brand={{ name: general.platformName, logoUrl: general.logoUrl }}
      initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
    >
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <PublicFooter
        brand={{ name: general.platformName, logoUrl: general.logoUrl, tagline: general.tagline }}
        footer={footer}
        email={general.contactEmail}
        phone={general.contactPhone}
      />
    </AppShell>
  );
}
