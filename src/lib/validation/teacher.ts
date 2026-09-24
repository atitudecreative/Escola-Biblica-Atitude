import { z } from "zod";

/**
 * Schemas Zod da área do professor (course builder, correção, comunicados).
 * Isomórfico: a UI usa para validar antes de enviar; o servidor valida SEMPRE.
 */
export const COURSE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export const LESSON_TYPES = ["VIDEO", "TEXT", "PDF", "AUDIO", "PRESENTATION", "FILE", "LINK", "QUIZ", "ASSIGNMENT"] as const;
export const VIDEO_PROVIDERS = ["URL", "UPLOAD", "YOUTUBE", "VIMEO", "PANDA"] as const;
export const QUESTION_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] as const;
export const FEEDBACK_MODES = ["NEVER", "AFTER_SUBMIT", "AFTER_PASS"] as const;

const id = z.string().min(1).max(40);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** URL http(s) ou caminho interno (/api/files/...). */
const urlLike = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/api/files/"), "Informe um endereço começando com https://")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const newCourseSchema = z.object({
  title: z.string().trim().min(4, "O título precisa de pelo menos 4 caracteres.").max(120, "Use no máximo 120 caracteres."),
  subtitle: optionalText(200),
  categoryId: z.string().max(40).optional().nullable(),
  level: z.enum(COURSE_LEVELS).default("BEGINNER"),
});
export type NewCourseInput = z.input<typeof newCourseSchema>;

export const courseDetailsSchema = z.object({
  courseId: id,
  title: z.string().trim().min(4, "O título precisa de pelo menos 4 caracteres.").max(120),
  subtitle: optionalText(200),
  slug: z
    .string()
    .trim()
    .min(3, "O endereço precisa de pelo menos 3 caracteres.")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  description: z.string().max(20000).default(""),
  coverUrl: urlLike,
  trailerUrl: urlLike,
  categoryId: z.string().max(40).optional().nullable(),
  level: z.enum(COURSE_LEVELS),
  language: z.string().trim().min(2).max(10).default("pt-BR"),
  workloadHours: z.coerce.number().int("Use um número inteiro.").min(0).max(2000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12, "Use no máximo 12 tags.").default([]),
  objectives: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  requirements: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  targetAudience: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  faq: z
    .array(z.object({ question: z.string().trim().min(1, "Informe a pergunta.").max(240), answer: z.string().trim().min(1, "Informe a resposta.").max(2000) }))
    .max(20)
    .default([]),
});
export type CourseDetailsInput = z.input<typeof courseDetailsSchema>;

export const courseSettingsSchema = z.object({
  courseId: id,
  sequential: z.boolean(),
  certificateEnabled: z.boolean(),
  certificateTemplateId: z.string().max(40).nullable().optional(),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  isFeatured: z.boolean().optional(),
});
export type CourseSettingsInput = z.input<typeof courseSettingsSchema>;

export const moduleSchema = z.object({
  courseId: id,
  title: z.string().trim().min(2, "Dê um nome ao módulo.").max(120),
  description: optionalText(500),
});

export const renameModuleSchema = z.object({ moduleId: id, title: z.string().trim().min(2, "Dê um nome ao módulo.").max(120), description: optionalText(500) });

export const newLessonSchema = z.object({
  courseId: id,
  moduleId: z.string().max(40).optional().nullable(),
  title: z.string().trim().min(2, "Dê um título à aula.").max(160),
  type: z.enum(LESSON_TYPES).default("VIDEO"),
});
export type NewLessonInput = z.input<typeof newLessonSchema>;

export const reorderSchema = z.object({
  courseId: id,
  modules: z.array(z.object({ id, lessonIds: z.array(id).max(500) })).max(200),
});

export const lessonSchema = z.object({
  lessonId: id,
  title: z.string().trim().min(2, "Dê um título à aula.").max(160),
  summary: optionalText(500),
  type: z.enum(LESSON_TYPES),
  content: z.string().max(100_000).default(""),
  videoProvider: z.enum(VIDEO_PROVIDERS).nullable().optional(),
  videoUrl: urlLike,
  captionsUrl: urlLike,
  externalUrl: urlLike,
  mediaFileId: z.string().max(40).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(0).max(1000),
  durationSecondsPart: z.coerce.number().int().min(0).max(59),
  isPreview: z.boolean(),
});
export type LessonInput = z.input<typeof lessonSchema>;

export const materialSchema = z
  .object({
    lessonId: id,
    title: z.string().trim().min(1, "Dê um nome ao material.").max(160),
    kind: z.enum(["FILE", "LINK"]),
    fileId: z.string().max(40).optional().nullable(),
    url: urlLike,
  })
  .refine((v) => (v.kind === "FILE" ? !!v.fileId : !!v.url), { message: "Informe o arquivo ou o link.", path: ["url"] });

export const quizSettingsSchema = z.object({
  lessonId: id,
  passingScore: z.coerce.number().int().min(0, "Mínimo 0%.").max(100, "Máximo 100%."),
  maxAttempts: z.coerce.number().int().min(0).max(50),
  shuffleQuestions: z.boolean(),
  timeLimitMinutes: z.coerce.number().int().min(0).max(600).nullable().optional(),
  feedbackMode: z.enum(FEEDBACK_MODES),
  requiredToComplete: z.boolean(),
});
export type QuizSettingsInput = z.input<typeof quizSettingsSchema>;

export const questionSchema = z
  .object({
    lessonId: id,
    questionId: z.string().max(40).optional().nullable(),
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(3, "Escreva o enunciado.").max(4000),
    explanation: optionalText(2000),
    points: z.coerce.number().int().min(0).max(100),
    acceptedAnswers: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    options: z.array(z.object({ text: z.string().trim().min(1, "Preencha a alternativa.").max(500), isCorrect: z.boolean() })).max(10).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") {
      if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Inclua ao menos duas alternativas." });
      const correct = q.options.filter((o) => o.isCorrect).length;
      if (correct === 0) ctx.addIssue({ code: "custom", path: ["options"], message: "Marque a alternativa correta." });
      if (q.type !== "MULTIPLE_CHOICE" && correct > 1) ctx.addIssue({ code: "custom", path: ["options"], message: "Marque apenas uma alternativa correta." });
    }
    if (q.type === "SHORT_ANSWER" && q.acceptedAnswers.length === 0) {
      ctx.addIssue({ code: "custom", path: ["acceptedAnswers"], message: "Informe ao menos uma resposta aceita." });
    }
  });
export type QuestionInput = z.input<typeof questionSchema>;

export const assignmentSchema = z
  .object({
    lessonId: id,
    instructions: z.string().max(50_000).default(""),
    dueAt: z.string().max(40).nullable().optional(),
    maxScore: z.coerce.number().int().min(1, "A nota máxima precisa ser maior que zero.").max(1000),
    passingScore: z.coerce.number().int().min(0).max(1000),
    allowText: z.boolean(),
    allowFile: z.boolean(),
  })
  .refine((v) => v.passingScore <= v.maxScore, { message: "A nota mínima não pode passar da nota máxima.", path: ["passingScore"] })
  .refine((v) => v.allowText || v.allowFile, { message: "Permita resposta em texto, arquivo ou ambos.", path: ["allowText"] });
export type AssignmentInput = z.input<typeof assignmentSchema>;

export const gradeSubmissionSchema = z.object({
  submissionId: id,
  status: z.enum(["APPROVED", "REJECTED", "RETURNED"]),
  score: z.coerce.number().min(0).max(1000).nullable().optional(),
  feedback: optionalText(5000),
});
export type GradeSubmissionInput = z.input<typeof gradeSubmissionSchema>;

export const gradeAttemptSchema = z.object({
  attemptId: id,
  answers: z.array(z.object({ answerId: id, pointsAwarded: z.coerce.number().min(0).max(1000), feedback: optionalText(2000) })).max(200),
});
export type GradeAttemptInput = z.input<typeof gradeAttemptSchema>;

export const announcementSchema = z
  .object({
    title: z.string().trim().min(3, "Dê um título ao comunicado.").max(140),
    body: z.string().trim().min(3, "Escreva a mensagem.").max(5000),
    audience: z.enum(["ALL", "ROLE", "COURSE", "USER"]).default("COURSE"),
    courseId: z.string().max(40).optional().nullable(),
    roleKey: z.enum(["student", "teacher", "manager", "admin"]).optional().nullable(),
    targetUserId: z.string().max(40).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "COURSE" && !v.courseId) ctx.addIssue({ code: "custom", path: ["courseId"], message: "Escolha o curso." });
    if (v.audience === "ROLE" && !v.roleKey) ctx.addIssue({ code: "custom", path: ["roleKey"], message: "Escolha o perfil." });
    if (v.audience === "USER" && !v.targetUserId) ctx.addIssue({ code: "custom", path: ["targetUserId"], message: "Escolha o destinatário." });
  });
export type AnnouncementInput = z.input<typeof announcementSchema>;
