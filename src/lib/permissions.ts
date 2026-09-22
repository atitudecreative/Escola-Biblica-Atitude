/**
 * Catálogo de permissões (RBAC).
 *
 * As permissões são a unidade de autorização; perfis (roles) são apenas
 * agrupamentos persistidos no banco (tabelas roles/permissions/role_permissions).
 * O mapeamento abaixo é o padrão semeado — o administrador pode alterá-lo em
 * /admin/permissions, o que prepara o sistema para permissões granulares.
 *
 * Este arquivo é isomórfico: a UI usa as chaves para esconder ações, mas a
 * verificação que vale é SEMPRE a do servidor (src/server/auth/guards.ts).
 */
export const PERMISSIONS = {
  // Aprendizado
  "learning.access": { group: "Aprendizado", description: "Acessar cursos, aulas e materiais em que está matriculado" },
  "community.participate": { group: "Comunidade", description: "Criar discussões, responder e curtir" },
  "community.moderate": { group: "Comunidade", description: "Fixar, trancar e remover discussões e respostas" },
  "messages.send": { group: "Comunicação", description: "Enviar mensagens diretas" },
  "support.respond": { group: "Comunicação", description: "Atender conversas de suporte" },

  // Ensino
  "courses.create": { group: "Cursos", description: "Criar novos cursos" },
  "courses.manage_own": { group: "Cursos", description: "Editar e gerenciar os próprios cursos" },
  "courses.manage_any": { group: "Cursos", description: "Editar e gerenciar qualquer curso" },
  "courses.publish": { group: "Cursos", description: "Publicar cursos sem passar por revisão" },
  "courses.view_all": { group: "Cursos", description: "Visualizar todos os cursos, inclusive rascunhos" },
  "grading.own": { group: "Ensino", description: "Corrigir atividades e avaliações dos próprios cursos" },
  "students.view_own": { group: "Ensino", description: "Ver alunos matriculados nos próprios cursos" },
  "announcements.course": { group: "Comunicação", description: "Enviar comunicados para turmas dos próprios cursos" },

  // Gestão
  "students.view_all": { group: "Gestão", description: "Ver todos os alunos e seu desempenho" },
  "users.view": { group: "Gestão", description: "Visualizar usuários" },
  "analytics.view": { group: "Gestão", description: "Ver indicadores e dashboards" },
  "reports.view": { group: "Gestão", description: "Acessar relatórios" },
  "reports.export": { group: "Gestão", description: "Exportar relatórios (CSV)" },

  // Administração
  "users.manage": { group: "Administração", description: "Criar, editar, bloquear usuários e redefinir senhas" },
  "enrollments.manage": { group: "Administração", description: "Matricular e remover matrículas" },
  "roles.manage": { group: "Administração", description: "Alterar perfis e permissões" },
  "categories.manage": { group: "Administração", description: "Gerenciar categorias e tags" },
  "banners.manage": { group: "Administração", description: "Gerenciar banners e conteúdo da home" },
  "settings.manage": { group: "Administração", description: "Alterar configurações da plataforma" },
  "certificates.manage": { group: "Administração", description: "Gerenciar modelos e revogar certificados" },
  "announcements.all": { group: "Comunicação", description: "Enviar comunicados para qualquer público" },
  "audit.view": { group: "Administração", description: "Consultar logs de auditoria e e-mails" },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_KEYS = ["student", "teacher", "manager", "admin"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  student: "Aluno",
  teacher: "Professor",
  manager: "Gestor",
  admin: "Administrador",
};

const STUDENT: Permission[] = ["learning.access", "community.participate", "messages.send"];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  student: STUDENT,
  teacher: [
    ...STUDENT,
    "courses.create",
    "courses.manage_own",
    "grading.own",
    "students.view_own",
    "announcements.course",
    "community.moderate",
  ],
  manager: [
    ...STUDENT,
    "courses.view_all",
    "students.view_all",
    "users.view",
    "analytics.view",
    "reports.view",
    "reports.export",
    "support.respond",
  ],
  admin: ALL_PERMISSIONS,
};

export function hasPermission(perms: readonly string[] | ReadonlySet<string>, p: Permission) {
  return perms instanceof Set ? perms.has(p) : (perms as readonly string[]).includes(p);
}
