import { requireUserPage } from "@/server/auth/guards";

/** Modo imersivo de estudo: sem a sidebar do app, foco total no conteúdo. */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage();
  return <div className="min-h-dvh bg-bg">{children}</div>;
}
