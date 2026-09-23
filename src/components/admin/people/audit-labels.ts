/** Rótulos legíveis para ações de auditoria mais comuns no histórico de uma pessoa. */
const LABELS: Record<string, string> = {
  "auth.login": "Entrou na plataforma",
  "auth.login_failed": "Tentativa de login com senha incorreta",
  "auth.register": "Criou a conta",
  "auth.password_reset_requested": "Pediu redefinição de senha",
  "auth.password_reset": "Redefiniu a senha",
  "auth.password_changed": "Alterou a senha",
  "auth.email_verified": "Confirmou o e-mail",
  "user.created": "Conta criada pela administração",
  "user.updated": "Dados da conta atualizados",
  "user.blocked": "Conta bloqueada",
  "user.activated": "Conta reativada",
  "user.deactivated": "Conta inativada",
  "user.password_reset_sent": "Link de senha enviado pela administração",
  "enrollment.created": "Matrícula criada",
  "enrollment.cancelled": "Matrícula removida",
  "course.completed": "Concluiu um curso",
  "report.exported": "Exportou um relatório",
};

export function auditLabel(action: string) {
  return LABELS[action] ?? action;
}
