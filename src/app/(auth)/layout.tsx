import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { headers } from "next/headers";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [general, user, h] = await Promise.all([getSettings("general"), getSessionUser(), headers()]);
  const path = h.get("x-pathname") ?? "";
  // Usuário logado não precisa ver login/cadastro (mas pode verificar e-mail).
  if (user && (path.startsWith("/login") || path.startsWith("/register"))) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative isolate flex flex-col px-5 py-6 sm:px-10">
        <div aria-hidden className="page-backdrop pointer-events-none absolute inset-0 -z-10" />
        <Logo name={general.platformName} logoUrl={general.logoUrl} />
        <main id="conteudo" className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-caption text-subtle">© {new Date().getFullYear()} {general.platformName}</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-primary lg:block" aria-hidden>
        <AuthArtwork />
        <div className="absolute inset-x-0 bottom-0 p-12 text-primary-fg">
          <p className="max-w-md font-display text-[2rem] leading-[1.15] tracking-tight">
            “Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.”
          </p>
          <p className="mt-4 text-sm opacity-75">Salmos 119:105</p>
          <p className="mt-10 max-w-sm text-sm opacity-80">{general.tagline}</p>
        </div>
      </aside>
    </div>
  );
}

/** Composição geométrica sutil: arcos concêntricos que remetem à luz se expandindo. */
function AuthArtwork() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="g" cx="78%" cy="18%" r="70%">
          <stop offset="0" stopColor="var(--brand-accent)" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="var(--brand-accent)" stopOpacity="0.08" />
          <stop offset="1" stopColor="var(--brand-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="800" fill="url(#g)" />
      {Array.from({ length: 9 }).map((_, i) => (
        <circle key={i} cx="470" cy="150" r={60 + i * 62} fill="none" stroke="white" strokeOpacity={0.12 - i * 0.011} />
      ))}
    </svg>
  );
}
