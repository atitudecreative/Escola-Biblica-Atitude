import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { ACCOUNT_NAV, SIDEBAR_COOKIE, filterNav } from "@/components/layout/nav-config";
import { requireUserPage } from "@/server/auth/guards";
import { getSettings } from "@/server/settings";
import { primaryRoleLabel, shellCounts } from "@/server/services/shell";
import { EmailVerificationBanner } from "@/components/layout/verification-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();
  const [general, counts, jar] = await Promise.all([getSettings("general"), shellCounts(user), cookies()]);
  return (
    <AppShell
      sections={filterNav(user.permissions, user.roles)}
      footerItems={ACCOUNT_NAV}
      counts={counts}
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl, roleLabel: primaryRoleLabel(user.roles) }}
      brand={{ name: general.platformName, logoUrl: general.logoUrl }}
      banner={!user.emailVerified ? <EmailVerificationBanner /> : undefined}
      initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
    >
      {children}
    </AppShell>
  );
}
