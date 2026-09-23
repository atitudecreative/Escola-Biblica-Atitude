import type {
  CourseLevel,
  CourseStatus,
  EnrollmentStatus,
  LessonType,
  QuestionType,
  SubmissionStatus,
  UserStatus,
  NotificationType,
} from "@prisma/client";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "accent";

export const COURSE_STATUS: Record<CourseStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  REVIEW: { label: "Em revisão", tone: "warning" },
  PUBLISHED: { label: "Publicado", tone: "success" },
  ARCHIVED: { label: "Arquivado", tone: "neutral" },
};

export const COURSE_LEVEL: Record<CourseLevel, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

export const ENROLLMENT_STATUS: Record<EnrollmentStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Em andamento", tone: "info" },
  COMPLETED: { label: "Concluído", tone: "success" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};

export const USER_STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Ativo", tone: "success" },
  INACTIVE: { label: "Inativo", tone: "neutral" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
};

export const LESSON_TYPE: Record<LessonType, string> = {
  VIDEO: "Vídeo",
  TEXT: "Texto",
  PDF: "PDF",
  AUDIO: "Áudio",
  PRESENTATION: "Apresentação",
  FILE: "Arquivo",
  LINK: "Link",
  QUIZ: "Questionário",
  ASSIGNMENT: "Atividade",
};

export const QUESTION_TYPE: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Múltipla escolha (uma resposta)",
  MULTIPLE_CHOICE: "Múltipla escolha (várias respostas)",
  TRUE_FALSE: "Verdadeiro ou falso",
  SHORT_ANSWER: "Resposta curta",
  ESSAY: "Resposta aberta",
};

export const SUBMISSION_STATUS: Record<SubmissionStatus | "PENDING", { label: string; tone: Tone }> = {
  PENDING: { label: "Pendente", tone: "neutral" },
  SUBMITTED: { label: "Enviado", tone: "info" },
  GRADING: { label: "Corrigindo", tone: "warning" },
  RETURNED: { label: "Devolvido para ajustes", tone: "warning" },
  APPROVED: { label: "Aprovado", tone: "success" },
  REJECTED: { label: "Reprovado", tone: "danger" },
};

export const NOTIFICATION_TYPE: Record<NotificationType, string> = {
  NEW_LESSON: "Nova aula",
  NEW_ASSIGNMENT: "Nova atividade",
  ASSIGNMENT_GRADED: "Atividade corrigida",
  QUIZ_GRADED: "Avaliação corrigida",
  MESSAGE: "Mensagem",
  ANNOUNCEMENT: "Comunicado",
  CERTIFICATE: "Certificado",
  COURSE: "Curso",
  COMMUNITY: "Comunidade",
  ACHIEVEMENT: "Conquista",
  SYSTEM: "Sistema",
};
