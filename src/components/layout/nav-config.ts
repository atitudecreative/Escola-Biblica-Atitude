import type { Permission, RoleKey } from "@/lib/permissions";

/** Cookie com o estado da sidebar (lido no servidor para não piscar ao carregar). */
export const SIDEBAR_COOKIE = "eba_sidebar";

/**
 * Navegação do app. Cada seção/item declara as permissões necessárias
 * (qualquer uma delas basta). A sidebar é montada no servidor filtrando
 * pelas permissões do usuário — o mesmo usuário pode ter vários perfis.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: string; // chave do mapa de ícones em sidebar.tsx
  perms?: Permission[];
  badge?: "messages" | "notifications" | "grading";
  exact?: boolean;
};

export type NavSection = { title?: string; perms?: Permission[]; roles?: RoleKey[]; items: NavItem[] };

export const NAV: NavSection[] = [
  { items: [{ label: "Início", href: "/", icon: "home", exact: true }] },
  {
    title: "Aprendizado",
    perms: ["learning.access"],
    items: [
      { label: "Painel de estudos", href: "/dashboard", icon: "gauge", exact: true },
      { label: "Meus cursos", href: "/my-courses", icon: "book" },
      { label: "Catálogo", href: "/courses", icon: "compass" },
      { label: "Atividades", href: "/assignments", icon: "clipboard" },
      { label: "Favoritos", href: "/favorites", icon: "bookmark" },
      { label: "Certificados", href: "/certificates", icon: "award" },
    ],
  },
  {
    title: "Comunicação",
    items: [
      { label: "Mensagens", href: "/messages", icon: "message", badge: "messages", perms: ["messages.send", "support.respond"] },
      { label: "Notificações", href: "/notifications", icon: "bell", badge: "notifications" },
      { label: "Comunicados", href: "/announcements", icon: "megaphone" },
    ],
  },
  {
    title: "Comunidade",
    perms: ["community.participate", "community.moderate"],
    items: [
      { label: "Discussões", href: "/community", icon: "users", exact: true },
      { label: "Perguntas", href: "/community/questions", icon: "help" },
    ],
  },
  {
    title: "Ensino",
    // O admin também cria e edita cursos (tem courses.create/manage_any).
    roles: ["teacher", "admin"],
    perms: ["courses.manage_own", "courses.create"],
    items: [
      { label: "Painel do professor", href: "/teacher", icon: "gauge", exact: true },
      { label: "Meus cursos", href: "/teacher/courses", icon: "layers" },
      { label: "Alunos", href: "/teacher/students", icon: "graduation" },
      { label: "Correções", href: "/teacher/grading", icon: "check", badge: "grading" },
    ],
  },
  {
    title: "Gestão",
    roles: ["manager"],
    perms: ["analytics.view"],
    items: [
      { label: "Indicadores", href: "/manager", icon: "chart", exact: true },
      { label: "Relatórios", href: "/manager/reports", icon: "file-chart" },
      { label: "Alunos", href: "/admin/students", icon: "graduation", perms: ["students.view_all"] },
      { label: "Professores", href: "/admin/teachers", icon: "presentation", perms: ["users.view"] },
      { label: "Cursos", href: "/admin/courses", icon: "layers", perms: ["courses.view_all"] },
    ],
  },
  {
    title: "Administração",
    perms: ["users.manage", "settings.manage", "roles.manage"],
    items: [
      { label: "Visão geral", href: "/admin", icon: "gauge", exact: true },
      { label: "Usuários", href: "/admin/users", icon: "users", perms: ["users.manage"] },
      { label: "Cursos", href: "/admin/courses", icon: "layers", perms: ["courses.manage_any"] },
      { label: "Categorias e tags", href: "/admin/categories", icon: "tags", perms: ["categories.manage"] },
      { label: "Banners e home", href: "/admin/banners", icon: "image", perms: ["banners.manage"] },
      { label: "Certificados", href: "/admin/certificates", icon: "award", perms: ["certificates.manage"] },
      { label: "Configurações", href: "/admin/settings", icon: "settings", perms: ["settings.manage"] },
      { label: "Permissões", href: "/admin/permissions", icon: "shield", perms: ["roles.manage"] },
      { label: "Logs", href: "/admin/logs", icon: "scroll", perms: ["audit.view"] },
    ],
  },
];

/** Visitante sem conta: só o que é público. */
export const PUBLIC_NAV: NavSection[] = [
  {
    items: [
      { label: "Início", href: "/", icon: "home", exact: true },
      { label: "Catálogo", href: "/courses", icon: "compass" },
      { label: "Validar certificado", href: "/certificate", icon: "badge-check" },
    ],
  },
];

/** Rodapé da sidebar para quem está logado. */
export const ACCOUNT_NAV: NavItem[] = [
  { label: "Perfil", href: "/profile", icon: "user", exact: true },
  { label: "Configurações", href: "/profile/settings", icon: "settings" },
];

export function filterNav(perms: Set<string>, roles: RoleKey[]): NavSection[] {
  const ok = (p?: Permission[]) => !p || p.some((x) => perms.has(x));
  const hasRole = (r?: RoleKey[]) => !r || r.some((x) => roles.includes(x));
  const seen = new Set<string>();
  // Seções de papel específico (Ensino, Gestão) aparecem só para quem tem o perfil;
  // o admin acessa essas áreas pelos atalhos da Administração.
  return NAV.filter((s) => ok(s.perms) && hasRole(s.roles))
    .map((s) => ({
      ...s,
      // Evita itens duplicados (ex.: "Cursos" em Gestão e Administração para o admin).
      items: s.items.filter((i) => {
        if (!ok(i.perms)) return false;
        if (seen.has(i.href)) return false;
        seen.add(i.href);
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);
}
