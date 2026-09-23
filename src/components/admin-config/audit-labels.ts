/**
 * Rótulos legíveis para ações da auditoria. Ações desconhecidas são
 * humanizadas a partir de "entidade.verbo" (ex.: user.blocked → "Usuário · bloqueado").
 */
const EXACT: Record<string, string> = {
  "auth.login": "Entrou na plataforma",
  "auth.login_failed": "Tentativa de login falhou",
  "auth.register": "Criou uma conta",
  "auth.password_reset_requested": "Pediu redefinição de senha",
  "auth.password_reset": "Redefiniu a senha",
  "auth.password_changed": "Alterou a senha",
  "auth.email_verified": "Confirmou o e-mail",
  "settings.updated": "Alterou configurações",
  "session.revoked": "Encerrou uma sessão",
  "course.submitted_for_review": "Enviou curso para revisão",
  "course.returned": "Devolveu curso para ajustes",
  "course.returned_to_draft": "Voltou curso para rascunho",
  "course.instructor_changed": "Trocou o professor responsável",
  "course.featured": "Destacou curso na home",
  "course.unfeatured": "Removeu curso dos destaques",
  "certificate.issued_manually": "Emitiu certificado manualmente",
  "certificate_template.default_set": "Definiu modelo de certificado padrão",
  "roles.permissions_updated": "Alterou permissões de perfil",
  "roles.created": "Criou perfil personalizado",
  "roles.deleted": "Excluiu perfil personalizado",
  "tag.merged": "Mesclou tags",
  "webhook.tested": "Enviou teste de webhook",
  "webhook.secret_rotated": "Gerou novo segredo de webhook",
  "report.exported": "Exportou relatório",
  "audit.exported": "Exportou a auditoria",
  "announcement.sent": "Enviou comunicado",
};

const ENTITY: Record<string, string> = {
  auth: "Acesso",
  user: "Usuário",
  users: "Usuário",
  course: "Curso",
  module: "Módulo",
  lesson: "Aula",
  material: "Material",
  quiz: "Questionário",
  assignment: "Atividade",
  enrollment: "Matrícula",
  certificate: "Certificado",
  certificate_template: "Modelo de certificado",
  category: "Categoria",
  tag: "Tag",
  banner: "Banner",
  settings: "Configurações",
  setting: "Configurações",
  roles: "Perfil",
  role: "Perfil",
  webhook: "Webhook",
  announcement: "Comunicado",
  session: "Sessão",
  report: "Relatório",
  thread: "Discussão",
  reply: "Resposta",
  community: "Comunidade",
  message: "Mensagem",
  review: "Avaliação",
  quiz_attempt: "Tentativa de questionário",
  submission: "Entrega de atividade",
  file: "Arquivo",
  audit: "Auditoria",
  conversation: "Conversa",
};

const VERB: Record<string, string> = {
  created: "criado(a)",
  submitted: "enviado(a)",
  sent: "enviado(a)",
  approved: "aprovado(a)",
  rejected: "reprovado(a)",
  returned: "devolvido(a)",
  uploaded: "enviado(a)",
  started: "iniciado(a)",
  merged: "mesclado(a)",
  tested: "testado(a)",
  featured: "destacado(a)",
  updated: "atualizado(a)",
  deleted: "excluído(a)",
  removed: "removido(a)",
  added: "adicionado(a)",
  published: "publicado(a)",
  archived: "arquivado(a)",
  restored: "restaurado(a)",
  revoked: "revogado(a)",
  issued: "emitido(a)",
  completed: "concluído(a)",
  cancelled: "cancelado(a)",
  duplicated: "duplicado(a)",
  reordered: "reordenado(a)",
  renamed: "renomeado(a)",
  graded: "corrigido(a)",
  blocked: "bloqueado(a)",
  unblocked: "desbloqueado(a)",
  activated: "ativado(a)",
  deactivated: "desativado(a)",
  invited: "convidado(a)",
  exported: "exportado(a)",
  pinned: "fixado(a)",
  locked: "trancado(a)",
  moderated: "moderado(a)",
  question_added: "questão adicionada",
  question_deleted: "questão excluída",
  roles_changed: "perfis alterados",
  password_reset: "senha redefinida",
};

export function auditActionLabel(action: string) {
  if (EXACT[action]) return EXACT[action];
  const [entity, ...rest] = action.split(".");
  const verb = rest.join(".");
  const e = ENTITY[entity] ?? entity;
  const v = VERB[verb] ?? verb.replace(/_/g, " ");
  return v ? `${e} ${v}` : e;
}

export function entityLabel(entityType: string | null | undefined) {
  if (!entityType) return "—";
  return ENTITY[entityType] ?? entityType;
}

/** Tom visual da ação (para o ponto colorido na lista). */
export function auditTone(action: string): "danger" | "warning" | "success" | "neutral" {
  if (/failed|deleted|revoked|blocked/.test(action)) return "danger";
  if (/settings|roles|permissions|webhook|session/.test(action)) return "warning";
  if (/published|issued|created|restored/.test(action)) return "success";
  return "neutral";
}
