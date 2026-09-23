/**
 * Seed de demonstração: `npm run db:seed`
 *
 * Recria TODOS os dados (TRUNCATE) — use apenas em desenvolvimento/demonstração.
 * Senha de todas as contas: Demo@2026
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLE_KEYS, ROLE_LABELS } from "../src/lib/permissions";
import {
  ACHIEVEMENTS, ADMIN, BENEFITS, CATEGORIES, COURSES, FIRST_NAMES, LAST_NAMES, MANAGERS, QUIZ_BANK, REPLIES,
  STUDENTS, TEACHERS, TESTIMONIALS, THREADS, textLesson,
} from "./seed-data";

const db = new PrismaClient();
const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (d: number, jitterHours = 0) => new Date(now - d * DAY - Math.floor(rand() * jitterHours * 3_600_000));

// PRNG determinístico — a demonstração é sempre igual.
let seed = 20260922;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const STORAGE = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");

async function makePdf(title: string, course: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const green = rgb(0.12, 0.36, 0.29);
  page.drawRectangle({ x: 0, y: 792, width: 595, height: 50, color: green });
  page.drawText("ESCOLA BÍBLICA ATITUDE", { x: 48, y: 812, font: sans, size: 10, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 48, y: 730, font: serif, size: 26, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(course, { x: 48, y: 704, font: sans, size: 12, color: rgb(0.4, 0.4, 0.4) });
  const lines = [
    "Roteiro de estudo",
    "",
    "1. Leia o texto bíblico indicado na aula com atenção.",
    "2. Anote palavras que se repetem e perguntas que surgirem.",
    "3. Identifique o contexto: autor, destinatários e situação.",
    "4. Resuma a ideia central em uma frase.",
    "5. Escreva uma aplicação prática para esta semana.",
    "",
    "Perguntas para discussão em grupo",
    "",
    "- O que este texto revela sobre Deus?",
    "- O que ele revela sobre nós?",
    "- Como ele se conecta com a história de Jesus?",
    "- Que passo concreto posso dar a partir dele?",
  ];
  lines.forEach((l, i) => page.drawText(l, { x: 48, y: 650 - i * 22, font: l.match(/^\d|^-/) || !l ? sans : serif, size: l.match(/^\d|^-/) ? 11 : 15, color: rgb(0.15, 0.15, 0.15) }));
  page.drawText("Material demonstrativo gerado para a plataforma.", { x: 48, y: 48, font: sans, size: 8, color: rgb(0.5, 0.5, 0.5) });
  return Buffer.from(await pdf.save());
}

async function storeFile(ownerId: string, name: string, data: Buffer, mimeType: string, purpose: string) {
  const ext = name.split(".").pop();
  const key = `${purpose}/seed/${randomBytes(12).toString("hex")}.${ext}`;
  const full = path.join(STORAGE, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return db.fileAsset.create({ data: { ownerId, storageKey: key, originalName: name, mimeType, sizeBytes: data.length, visibility: "PRIVATE" } });
}

async function wipe() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

async function main() {
  console.log("→ Limpando banco…");
  await wipe();

  // ── RBAC ──────────────────────────────────────────────
  console.log("→ Perfis e permissões");
  const perms = await Promise.all(
    Object.entries(PERMISSIONS).map(([key, v]) => db.permission.create({ data: { key, group: v.group, description: v.description } })),
  );
  const permId = new Map(perms.map((p) => [p.key, p.id]));
  const roleDesc = {
    student: "Consome cursos, participa da comunidade e conversa com professores.",
    teacher: "Cria e administra cursos, corrige atividades e acompanha turmas.",
    manager: "Acompanha indicadores, relatórios, alunos e professores.",
    admin: "Controle completo da plataforma.",
  };
  const roles: Record<string, string> = {};
  for (const key of ROLE_KEYS) {
    const role = await db.role.create({
      data: {
        key,
        name: ROLE_LABELS[key],
        description: roleDesc[key],
        permissions: { create: DEFAULT_ROLE_PERMISSIONS[key].map((p) => ({ permissionId: permId.get(p)! })) },
      },
    });
    roles[key] = role.id;
  }

  // ── Usuários ──────────────────────────────────────────
  console.log("→ Usuários");
  const passwordHash = await hash("Demo@2026", { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const mkUser = (u: { name: string; email: string; headline?: string; bio?: string }, roleKeys: string[], createdAt: Date, extra: Partial<Prisma.UserCreateInput> = {}) =>
    db.user.create({
      data: {
        name: u.name,
        email: u.email,
        headline: u.headline,
        bio: u.bio,
        passwordHash,
        emailVerifiedAt: createdAt,
        createdAt,
        lastSeenAt: daysAgo(between(0, 3), 20),
        roles: { create: roleKeys.map((k) => ({ roleId: roles[k] })) },
        ...extra,
      },
    });

  const admin = await mkUser(ADMIN, ["admin", "student"], daysAgo(400));
  const managers = [];
  for (const m of MANAGERS) managers.push(await mkUser(m, ["manager", "student"], daysAgo(between(300, 380))));
  const teachers = [];
  for (const t of TEACHERS) teachers.push(await mkUser(t, ["teacher", "student"], daysAgo(between(320, 390))));
  const students = [];
  for (const [i, s] of STUDENTS.entries()) {
    students.push(await mkUser(s, ["student"], daysAgo(i === 0 ? 150 : between(20, 170)), { phone: i === 0 ? "(11) 98888-1234" : null, bio: i === 0 ? "Sirvo no ministério de pequenos grupos e amo estudar a Bíblia com outras pessoas." : null }));
  }
  // Base maior de alunos para indicadores realistas (crescimento ao longo de 6 meses).
  const crowd = [];
  for (let i = 0; i < 46; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const createdAt = daysAgo(Math.floor(Math.pow(rand(), 0.7) * 180));
    crowd.push(
      await mkUser(
        { name: `${first} ${last}`, email: `${first}.${last}.${i}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() + "@exemplo.com" },
        ["student"],
        createdAt,
        { status: i % 17 === 0 ? "INACTIVE" : i === 23 ? "BLOCKED" : "ACTIVE", lastSeenAt: daysAgo(between(0, 60)) },
      ),
    );
  }
  const allStudents = [...students, ...crowd];

  // ── Catálogo ──────────────────────────────────────────
  console.log("→ Categorias, tags e modelo de certificado");
  const categories: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) categories[c.slug] = (await db.category.create({ data: { ...c, position: i } })).id;

  const template = await db.certificateTemplate.create({
    data: {
      name: "Padrão da Escola",
      heading: "Certificado de Conclusão",
      body: "concluiu com aproveitamento o curso {{curso}}, ministrado por {{professor}}, com carga horária de {{carga}} horas, em {{data}}.",
      signatureName: ADMIN.name,
      signatureRole: "Coordenação da Escola Bíblica Atitude",
      accentColor: "#1F5B4B",
      isDefault: true,
    },
  });

  const tagIds = new Map<string, string>();
  const tagFor = async (name: string) => {
    const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!tagIds.has(slug)) tagIds.set(slug, (await db.tag.create({ data: { name, slug } })).id);
    return tagIds.get(slug)!;
  };

  // ── Cursos ────────────────────────────────────────────
  console.log("→ Cursos, módulos, aulas, materiais e avaliações");
  type Built = { id: string; slug: string; title: string; status: string; instructorId: string; lessons: { id: string; type: string; seconds: number; quizId?: string; assignmentId?: string }[]; quizIds: string[]; assignmentIds: string[] };
  const built: Built[] = [];
  let videoN = 0;

  for (const [ci, c] of COURSES.entries()) {
    const teacher = teachers[c.teacher];
    const publishedAt = c.status === "PUBLISHED" ? daysAgo(200 - ci * 14) : null;
    const course = await db.course.create({
      data: {
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        level: c.level,
        status: c.status,
        categoryId: categories[c.category],
        instructorId: teacher.id,
        requirements: c.requirements,
        objectives: c.objectives,
        targetAudience: c.audience,
        workloadHours: c.workloadHours,
        isFeatured: !!c.featured,
        sequential: !!c.sequential,
        certificateTemplateId: template.id,
        publishedAt,
        createdAt: daysAgo(230 - ci * 12),
        faq: [
          { question: "O curso é gratuito?", answer: "Sim. Os cursos abertos da Escola são gratuitos para membros e visitantes." },
          { question: "Por quanto tempo tenho acesso?", answer: "O acesso é ilimitado: você pode rever as aulas quando quiser." },
          { question: "Recebo certificado?", answer: `Sim. Ao concluir todas as aulas você recebe um certificado de ${c.workloadHours} horas, com código de validação.` },
        ],
        tags: { create: await Promise.all(c.tags.map(async (t) => ({ tagId: await tagFor(t) }))) },
      },
    });

    const b: Built = { id: course.id, slug: c.slug, title: c.title, status: c.status, instructorId: teacher.id, lessons: [], quizIds: [], assignmentIds: [] };
    let totalSeconds = 0;

    // Materiais gerais do curso
    const guide = await storeFile(teacher.id, `Guia do curso - ${c.title}.pdf`, await makePdf("Guia do curso", c.title), "application/pdf", "material");
    await db.material.create({ data: { courseId: course.id, title: "Guia completo do curso", kind: "FILE", fileId: guide.id, position: 0 } });
    await db.material.create({ data: { courseId: course.id, title: "Bíblia online (várias traduções)", kind: "LINK", url: "https://www.bibliaonline.com.br", position: 1 } });

    for (const [mi, m] of c.modules.entries()) {
      const mod = await db.module.create({ data: { courseId: course.id, title: m.title, position: mi, description: `Módulo ${mi + 1} de ${c.modules.length}` } });
      for (const [li, l] of m.lessons.entries()) {
        const seconds = l.type === "VIDEO" ? 150 : (l.minutes ?? 10) * 60;
        totalSeconds += seconds;
        let mediaFileId: string | undefined;
        if (l.type === "PDF") {
          mediaFileId = (await storeFile(teacher.id, `${l.title}.pdf`, await makePdf(l.title, c.title), "application/pdf", "lessonMedia")).id;
        }
        const lesson = await db.lesson.create({
          data: {
            moduleId: mod.id,
            courseId: course.id,
            title: l.title,
            type: l.type,
            position: li,
            isPreview: !!l.preview,
            durationSeconds: seconds,
            summary: l.type === "VIDEO" ? "Assista à aula e acompanhe os pontos principais no material." : undefined,
            content: l.type === "TEXT" || l.type === "PDF" || l.type === "VIDEO" ? textLesson(l.title, c.title) : "",
            ...(l.type === "VIDEO"
              ? { videoProvider: "URL" as const, videoUrl: `/demo/videos/aula-${(videoN++ % 3) + 1}.mp4`, captionsUrl: "/demo/videos/aula.vtt" }
              : {}),
            mediaFileId,
          },
        });
        const entry: Built["lessons"][number] = { id: lesson.id, type: l.type, seconds };

        if (l.type === "PDF" && mediaFileId) {
          await db.material.create({ data: { courseId: course.id, lessonId: lesson.id, title: `${l.title} (PDF)`, kind: "FILE", fileId: mediaFileId } });
        }
        if (l.type === "QUIZ") {
          const quiz = await db.quiz.create({
            data: {
              courseId: course.id,
              lessonId: lesson.id,
              title: l.title,
              description: "Responda com calma. Você pode rever as aulas antes de começar.",
              passingScore: 70,
              maxAttempts: 3,
              shuffleQuestions: true,
              timeLimitMinutes: 20,
              feedbackMode: "AFTER_SUBMIT",
            },
          });
          for (const [qi, q] of QUIZ_BANK.entries()) {
            await db.question.create({
              data: {
                quizId: quiz.id,
                type: q.type,
                prompt: q.prompt,
                explanation: q.explanation,
                position: qi,
                points: q.type === "ESSAY" ? 2 : 1,
                acceptedAnswers: "accepted" in q ? q.accepted : [],
                options: "options" in q && q.options ? { create: q.options.map((o, oi) => ({ text: o.text, isCorrect: o.correct, position: oi })) } : undefined,
              },
            });
          }
          entry.quizId = quiz.id;
          b.quizIds.push(quiz.id);
        }
        if (l.type === "ASSIGNMENT") {
          const a = await db.assignment.create({
            data: {
              courseId: course.id,
              lessonId: lesson.id,
              title: l.title,
              instructions: `### Instruções\n\nEscreva um texto de 15 a 25 linhas relacionando o conteúdo do módulo **${m.title}** com a sua experiência.\n\n- Cite ao menos uma passagem bíblica.\n- Você pode responder no campo de texto ou anexar um arquivo (PDF ou DOCX).\n- A atividade vale **10 pontos**; a nota mínima para aprovação é **6**.`,
              dueAt: new Date(now + between(5, 20) * DAY),
              maxScore: 10,
              passingScore: 6,
            },
          });
          entry.assignmentId = a.id;
          b.assignmentIds.push(a.id);
        }
        b.lessons.push(entry);
      }
    }
    await db.course.update({ where: { id: course.id }, data: { durationMinutes: Math.round(totalSeconds / 60) } });
    built.push(b);
  }

  // ── Matrículas, progresso e atividade ─────────────────
  console.log("→ Matrículas, progresso e atividade de estudo");
  const published = built.filter((b) => b.status === "PUBLISHED");
  const activity = new Map<string, { seconds: number; lessons: number }>();
  const addActivity = (userId: string, date: Date, seconds: number, lessons: number) => {
    const key = `${userId}|${utcDay(date).toISOString()}`;
    const cur = activity.get(key) ?? { seconds: 0, lessons: 0 };
    cur.seconds += seconds;
    cur.lessons += lessons;
    activity.set(key, cur);
  };
  const xpRows: Prisma.XpEventCreateManyInput[] = [];
  const completedEnrollments: { id: string; userId: string; courseId: string; completedAt: Date }[] = [];

  // Plano explícito para a aluna demo (Ana): 1 concluído, 2 em andamento, 1 iniciado.
  const anaPlan: Record<string, number> = {
    "panorama-do-novo-testamento": 100,
    "panorama-do-antigo-testamento": 58,
    "hermeneutica-como-interpretar-a-biblia": 56,
    "lideranca-servidora": 12,
  };

  for (const [si, student] of allStudents.entries()) {
    const isAna = si === 0;
    const courses = isAna
      ? published.filter((p) => p.slug in anaPlan)
      : [...published].sort(() => rand() - 0.5).slice(0, si < 10 ? between(2, 5) : between(1, 3));
    const signup = student.createdAt.getTime();
    for (const course of courses) {
      const enrolledAt = new Date(Math.min(now - DAY, signup + between(0, 20) * DAY));
      const target = isAna ? anaPlan[course.slug] : pick([0, 8, 15, 25, 40, 55, 70, 85, 100, 100]);
      const doneCount = Math.round((target / 100) * course.lessons.length);
      const done = course.lessons.slice(0, doneCount);
      const span = Math.max(1, Math.floor((now - enrolledAt.getTime()) / DAY));

      const progressRows: Prisma.LessonProgressCreateManyInput[] = done.map((l, i) => {
        const at = new Date(Math.min(now - 3600_000, enrolledAt.getTime() + ((i + 1) / (done.length + 1)) * span * DAY));
        addActivity(student.id, at, l.seconds, 1);
        xpRows.push({ userId: student.id, reason: "lesson_completed", refId: l.id, amount: 10, createdAt: at });
        return { userId: student.id, lessonId: l.id, courseId: course.id, status: "COMPLETED", positionSeconds: l.seconds, watchedSeconds: l.seconds, completedAt: at, createdAt: at, updatedAt: at };
      });
      const current = course.lessons[doneCount];
      if (current && target > 0) {
        const pos = Math.floor(current.seconds * 0.4);
        const at = daysAgo(isAna ? 0 : between(0, 12), 10);
        progressRows.push({ userId: student.id, lessonId: current.id, courseId: course.id, status: "IN_PROGRESS", positionSeconds: pos, watchedSeconds: pos, createdAt: at, updatedAt: at });
        addActivity(student.id, at, pos, 0);
      }
      await db.lessonProgress.createMany({ data: progressRows });

      const completed = doneCount === course.lessons.length;
      const lastLesson = current ?? course.lessons[course.lessons.length - 1];
      const completedAt = completed ? (progressRows[done.length - 1]?.completedAt as Date) : null;
      const enrollment = await db.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          enrolledAt,
          status: completed ? "COMPLETED" : "ACTIVE",
          progressPercent: Math.round((doneCount / course.lessons.length) * 100),
          lastLessonId: target > 0 ? lastLesson.id : null,
          lastAccessedAt: target > 0 ? daysAgo(isAna ? 0 : between(0, 20), 12) : null,
          completedAt,
        },
      });
      if (completed) {
        completedEnrollments.push({ id: enrollment.id, userId: student.id, courseId: course.id, completedAt: completedAt! });
        xpRows.push({ userId: student.id, reason: "course_completed", refId: course.id, amount: 100, createdAt: completedAt! });
      }
    }
  }

  // Atividade diária extra para os últimos 90 dias (dá vida aos gráficos e streaks).
  for (const s of allStudents.slice(0, 30)) {
    for (let d = 0; d < 90; d++) {
      const p = s.id === students[0].id ? (d < 9 ? 1 : 0.55) : 0.18 + (90 - d) / 400;
      if (rand() < p) addActivity(s.id, daysAgo(d), between(6, 55) * 60, 0);
    }
  }
  await db.userActivityDay.createMany({
    data: [...activity.entries()].map(([key, v]) => {
      const [userId, iso] = key.split("|");
      return { userId, date: new Date(iso), seconds: v.seconds, lessons: v.lessons };
    }),
  });

  // Contadores dos cursos
  for (const b of built) {
    const count = await db.enrollment.count({ where: { courseId: b.id } });
    await db.course.update({ where: { id: b.id }, data: { enrollmentCount: count } });
  }

  // ── Certificados ──────────────────────────────────────
  console.log("→ Certificados");
  const ALPH = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const code = () => `EBA-2026-${Array.from({ length: 4 }, () => pick([...ALPH])).join("")}-${Array.from({ length: 4 }, () => pick([...ALPH])).join("")}`;
  for (const e of completedEnrollments) {
    const course = COURSES.find((c) => c.slug === built.find((b) => b.id === e.courseId)!.slug)!;
    const student = allStudents.find((s) => s.id === e.userId)!;
    await db.certificate.create({
      data: {
        code: e.userId === students[0].id ? "EBA-2026-DEMO-7K3P" : code(),
        userId: e.userId,
        courseId: e.courseId,
        enrollmentId: e.id,
        templateId: template.id,
        studentName: student.name,
        courseTitle: course.title,
        instructorName: TEACHERS[course.teacher].name,
        workloadHours: course.workloadHours,
        issuedAt: e.completedAt,
      },
    });
  }

  // ── Avaliações, atividades e entregas ─────────────────
  console.log("→ Tentativas de avaliação e entregas de atividades");
  for (const b of published) {
    const enrollments = await db.enrollment.findMany({ where: { courseId: b.id } });
    for (const e of enrollments) {
      const progress = await db.lessonProgress.findMany({ where: { userId: e.userId, courseId: b.id, status: "COMPLETED" }, select: { lessonId: true } });
      const doneSet = new Set(progress.map((p) => p.lessonId));
      for (const l of b.lessons) {
        if (l.quizId && doneSet.has(l.id)) {
          const questions = await db.question.findMany({ where: { quizId: l.quizId }, include: { options: true }, orderBy: { position: "asc" } });
          const at = daysAgo(between(1, 40));
          let earned = 0;
          let total = 0;
          const answers: Prisma.AttemptAnswerCreateManyAttemptInput[] = [];
          for (const q of questions) {
            total += q.points;
            if (q.type === "ESSAY") {
              earned += q.points * 0.8;
              answers.push({ questionId: q.id, textAnswer: "Este curso me ajudou a entender melhor o contexto dos textos e a compartilhar isso no meu grupo.", isCorrect: true, pointsAwarded: q.points * 0.8, feedback: "Boa reflexão!" });
            } else if (q.type === "SHORT_ANSWER") {
              earned += q.points;
              answers.push({ questionId: q.id, textAnswer: "aliança", isCorrect: true, pointsAwarded: q.points });
            } else {
              const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id);
              const right = rand() < 0.8;
              if (right) earned += q.points;
              answers.push({ questionId: q.id, selectedOptionIds: right ? correct : [q.options.find((o) => !o.isCorrect)!.id], isCorrect: right, pointsAwarded: right ? q.points : 0 });
            }
          }
          const score = Math.round((earned / total) * 1000) / 10;
          await db.quizAttempt.create({
            data: { quizId: l.quizId, userId: e.userId, attemptNumber: 1, status: "GRADED", questionOrder: questions.map((q) => q.id), score, pointsEarned: earned, pointsTotal: total, passed: score >= 70, startedAt: at, submittedAt: new Date(at.getTime() + 11 * 60_000), gradedAt: at, answers: { createMany: { data: answers } } },
          });
          if (score >= 70) xpRows.push({ userId: e.userId, reason: "quiz_passed", refId: l.quizId, amount: 25, createdAt: at });
        }
        if (l.assignmentId && doneSet.has(l.id)) {
          const status = pick(["APPROVED", "APPROVED", "APPROVED", "SUBMITTED", "GRADING", "RETURNED"] as const);
          const graded = status === "APPROVED" || status === "RETURNED";
          await db.assignmentSubmission.create({
            data: {
              assignmentId: l.assignmentId,
              userId: e.userId,
              textAnswer: "Neste módulo percebi como o texto bíblico conversa com situações concretas da minha semana. Escolhi uma passagem, li em duas traduções e anotei as diferenças. A principal aplicação foi retomar o hábito de orar com os salmos pela manhã, e compartilhei isso com meu pequeno grupo.",
              status,
              score: graded ? (status === "APPROVED" ? between(7, 10) : 5) : null,
              feedback: status === "APPROVED" ? "Ótimo trabalho! Reflexão clara e bem fundamentada." : status === "RETURNED" ? "Bom começo. Inclua ao menos uma passagem bíblica e desenvolva melhor a aplicação." : null,
              gradedById: graded ? b.instructorId : null,
              gradedAt: graded ? daysAgo(between(1, 10)) : null,
              submittedAt: daysAgo(between(1, 30)),
            },
          });
          if (status === "APPROVED") xpRows.push({ userId: e.userId, reason: "assignment_approved", refId: l.assignmentId, amount: 30, createdAt: daysAgo(between(1, 10)) });
        }
      }
    }
  }
  // Entrega pendente de correção da Ana (fluxo do professor).
  const hermeneutica = built.find((b) => b.slug === "hermeneutica-como-interpretar-a-biblia")!;
  const ana = students[0];
  await db.assignmentSubmission.upsert({
    where: { assignmentId_userId: { assignmentId: hermeneutica.assignmentIds[0], userId: ana.id } },
    create: { assignmentId: hermeneutica.assignmentIds[0], userId: ana.id, status: "SUBMITTED", submittedAt: daysAgo(1), textAnswer: "Escolhi Lucas 10:25-37 (o bom samaritano). Observação: a pergunta inicial é 'quem é o meu próximo?', mas Jesus termina perguntando 'quem agiu como próximo?'. Contexto: samaritanos e judeus eram inimigos. Aplicação: ser próximo é iniciativa, não categoria." },
    update: {},
  });

  // XP (livro-razão) + cache em users.xp
  await db.xpEvent.createMany({ data: xpRows, skipDuplicates: true });
  const sums = await db.xpEvent.groupBy({ by: ["userId"], _sum: { amount: true } });
  for (const s of sums) await db.user.update({ where: { id: s.userId }, data: { xp: s._sum.amount ?? 0 } });

  // ── Avaliações de curso (estrelas) ────────────────────
  console.log("→ Avaliações de cursos");
  const comments = ["Conteúdo excelente e muito bem explicado.", "Aulas objetivas, material de apoio muito bom.", "Mudou minha forma de estudar a Bíblia!", "Gostei muito, recomendo para toda a igreja.", "Professor didático e atencioso.", null, null];
  for (const b of published) {
    const enrolled = await db.enrollment.findMany({ where: { courseId: b.id, progressPercent: { gte: 40 } }, take: 14 });
    for (const e of enrolled) {
      await db.courseReview.create({ data: { courseId: b.id, userId: e.userId, rating: pick([5, 5, 5, 4, 4, 5, 3]), comment: pick(comments), createdAt: daysAgo(between(1, 60)) } });
    }
    const agg = await db.courseReview.aggregate({ where: { courseId: b.id }, _avg: { rating: true }, _count: true });
    await db.course.update({ where: { id: b.id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
  }

  // ── Comentários nas aulas ─────────────────────────────
  const at = built[0];
  for (const [i, text] of ["Que aula boa! A linha do tempo ajudou demais.", "Alguém mais achou a parte das alianças a mais importante?", "Anotei tudo no material de apoio. Obrigada, professor!"].entries()) {
    await db.lessonComment.create({ data: { lessonId: at.lessons[i % 2].id, userId: allStudents[i + 1].id, body: text, createdAt: daysAgo(between(1, 20)) } });
  }

  // ── Mensagens ─────────────────────────────────────────
  console.log("→ Conversas, notificações e comunicados");
  const convo = async (a: string, b: string, courseId: string | null, type: "DIRECT" | "SUPPORT", msgs: [0 | 1, string, number][]) => {
    const last = msgs[msgs.length - 1];
    const c = await db.conversation.create({
      data: {
        type,
        courseId,
        subject: type === "SUPPORT" ? "Suporte" : null,
        lastMessageAt: new Date(now - last[2] * 60_000),
        participants: { create: [{ userId: a, lastReadAt: new Date(now - last[2] * 60_000 + (last[0] === 0 ? 1000 : -1000)) }, { userId: b, lastReadAt: new Date(now - last[2] * 60_000 + (last[0] === 1 ? 1000 : -1000)) }] },
      },
    });
    for (const [who, body, mins] of msgs) {
      await db.message.create({ data: { conversationId: c.id, senderId: who === 0 ? a : b, body, createdAt: new Date(now - mins * 60_000) } });
    }
  };
  await convo(ana.id, teachers[0].id, built[0].id, "DIRECT", [
    [0, "Olá, professor! Tenho uma dúvida sobre a aula de Gênesis: como entender as genealogias?", 2900],
    [1, "Oi, Ana! Ótima pergunta. As genealogias mostram a continuidade da promessa de Deus de geração em geração. Na próxima aula falo mais disso.", 2700],
    [0, "Entendi! Faz muito sentido com o tema das alianças.", 2650],
    [1, "Exatamente. Se quiser, leia Gênesis 12 e 15 antes da próxima aula — vai ajudar bastante.", 95],
  ]);
  await convo(ana.id, managers[1].id, null, "SUPPORT", [
    [0, "Oi! Não estou conseguindo baixar o PDF do módulo 1 pelo celular.", 5000],
    [1, "Olá, Ana! Tente abrir pelo navegador do celular e tocar em “Baixar”. Se continuar, me avise que envio por aqui.", 4900],
    [0, "Funcionou, obrigada!", 4880],
  ]);
  await convo(teachers[0].id, managers[0].id, null, "DIRECT", [
    [1, "André, o curso de Missões Urbanas está em revisão. Podemos conversar sobre a carga horária?", 600],
    [0, "Claro, Juliana! Podemos ajustar para 10h com o novo módulo.", 540],
  ]);
  await convo(students[1].id, teachers[1].id, built[2].id, "DIRECT", [[0, "Professora, a atividade pode ser entregue em PDF?", 300], [1, "Pode sim, Lucas! PDF ou DOCX.", 240]]);

  const notes: Prisma.NotificationCreateManyInput[] = [
    { userId: ana.id, type: "MESSAGE", title: "Nova mensagem de Pr. André Carvalho", body: "Exatamente. Se quiser, leia Gênesis 12 e 15…", link: "/messages", createdAt: daysAgo(0, 2) },
    { userId: ana.id, type: "NEW_LESSON", title: "Nova aula disponível", body: "Divisão e exílio — Panorama do Antigo Testamento", link: `/courses/${built[0].slug}`, createdAt: daysAgo(1) },
    { userId: ana.id, type: "ANNOUNCEMENT", title: "Novo comunicado: Semana de formação de líderes", body: "Inscrições abertas para o encontro presencial.", link: "/announcements", createdAt: daysAgo(2) },
    { userId: ana.id, type: "CERTIFICATE", title: "Seu certificado está pronto", body: "Parabéns por concluir Panorama do Novo Testamento!", link: "/certificates", createdAt: daysAgo(6), readAt: daysAgo(5) },
    { userId: ana.id, type: "ACHIEVEMENT", title: "Conquista desbloqueada: Constância", body: "Concluiu 10 aulas.", link: "/profile#conquistas", createdAt: daysAgo(8), readAt: daysAgo(8) },
    { userId: ana.id, type: "ASSIGNMENT_GRADED", title: "Atividade corrigida", body: "Sua atividade foi aprovada.", link: "/assignments", createdAt: daysAgo(12), readAt: daysAgo(11) },
    { userId: teachers[0].id, type: "SYSTEM", title: "Entregas aguardando correção", body: "Há atividades novas nos seus cursos.", link: "/teacher/grading", createdAt: daysAgo(0, 5) },
  ];
  await db.notification.createMany({ data: notes });

  await db.announcement.create({ data: { authorId: admin.id, title: "Semana de formação de líderes", body: "Nos dias 10 a 12 de outubro teremos encontros presenciais para todos os alunos dos cursos de Liderança e Discipulado.\n\nAs inscrições estão abertas na secretaria da igreja. Esperamos você!", audience: "ALL", recipients: allStudents.length + 6, createdAt: daysAgo(2) } });
  await db.announcement.create({ data: { authorId: teachers[0].id, title: "Material extra do módulo 2", body: "Pessoal, adicionei um guia de leitura dos livros históricos na aba Materiais. Aproveitem!", audience: "COURSE", courseId: built[0].id, recipients: 20, createdAt: daysAgo(4) } });
  await db.announcement.create({ data: { authorId: admin.id, title: "Novidade: certificados com QR Code", body: "Agora todos os certificados emitidos pela Escola podem ser validados publicamente pelo código ou QR Code.", audience: "ALL", recipients: allStudents.length + 6, createdAt: daysAgo(15) } });

  // ── Comunidade ────────────────────────────────────────
  console.log("→ Comunidade");
  for (const [ti, t] of THREADS.entries()) {
    const author = ti === 1 ? admin : allStudents[(ti * 3 + 1) % 10];
    const created = daysAgo(between(2, 40));
    const thread = await db.discussionThread.create({
      data: { authorId: author.id, title: t.title, body: t.body, type: t.type as "QUESTION" | "DISCUSSION", courseId: t.course != null ? built[t.course].id : null, isPinned: t.pinned, createdAt: created, lastActivityAt: created, viewCount: between(20, 180) },
    });
    const replyCount = ti === 1 ? 1 : between(2, 4);
    let solutionId: string | null = null;
    for (let r = 0; r < replyCount; r++) {
      const replier = r === 0 && t.type === "QUESTION" ? teachers[t.course != null ? COURSES[t.course].teacher : 0] : allStudents[(ti + r + 4) % 10];
      const rep = await db.discussionReply.create({ data: { threadId: thread.id, authorId: replier.id, body: REPLIES[(ti + r) % REPLIES.length], createdAt: new Date(created.getTime() + (r + 1) * 3 * 3_600_000), likeCount: between(0, 6) } });
      if (r === 0 && t.solved) solutionId = rep.id;
    }
    const likes = allStudents.slice(0, between(1, 8));
    await db.discussionLike.createMany({ data: likes.map((u) => ({ userId: u.id, threadId: thread.id })) });
    await db.discussionThread.update({ where: { id: thread.id }, data: { replyCount, likeCount: likes.length, solutionReplyId: solutionId, lastActivityAt: new Date(created.getTime() + replyCount * 3 * 3_600_000) } });
  }

  // ── Favoritos ─────────────────────────────────────────
  await db.favorite.create({ data: { userId: ana.id, type: "COURSE", courseId: built[4].id } });
  await db.favorite.create({ data: { userId: ana.id, type: "COURSE", courseId: built[5].id } });
  await db.favorite.create({ data: { userId: ana.id, type: "LESSON", lessonId: built[0].lessons[1].id } });
  const anyMaterial = await db.material.findFirst({ where: { courseId: built[2].id, kind: "FILE" } });
  if (anyMaterial) await db.favorite.create({ data: { userId: ana.id, type: "MATERIAL", materialId: anyMaterial.id } });

  // ── Gamificação ───────────────────────────────────────
  console.log("→ Conquistas");
  for (const a of ACHIEVEMENTS) await db.achievement.create({ data: a });
  const achievements = await db.achievement.findMany();
  for (const s of allStudents.slice(0, 20)) {
    const lessonsDone = await db.lessonProgress.count({ where: { userId: s.id, status: "COMPLETED" } });
    const coursesDone = await db.enrollment.count({ where: { userId: s.id, status: "COMPLETED" } });
    const quizzes = await db.xpEvent.count({ where: { userId: s.id, reason: "quiz_passed" } });
    const metrics: Record<string, number> = { lessons_completed: lessonsDone, courses_completed: coursesDone, quizzes_passed: quizzes, streak_days: s.id === ana.id ? 9 : 0, threads_created: 0, solutions: 0 };
    for (const a of achievements) {
      const c = a.criteria as { metric: string; count: number };
      if ((metrics[c.metric] ?? 0) >= c.count) await db.userAchievement.create({ data: { userId: s.id, achievementId: a.id, awardedAt: daysAgo(between(1, 60)) } });
    }
  }

  // ── CMS: banners e configurações ──────────────────────
  console.log("→ Banners e configurações");
  await db.banner.createMany({
    data: [
      { placement: "HOME_HERO", position: 0, eyebrow: "Novo semestre · inscrições abertas", title: "Aprofunde sua fé com formação bíblica de verdade", subtitle: "Cursos gratuitos de Bíblia, teologia e liderança, com professores da Igreja Batista Atitude e certificado ao final.", ctaLabel: "Explorar cursos", ctaHref: "/courses" },
      { placement: "HOME_HERO", position: 1, eyebrow: "Destaque", title: "Hermenêutica: aprenda a interpretar a Bíblia", subtitle: "Um método prático para ler o texto com fidelidade — da observação à aplicação.", ctaLabel: "Conhecer o curso", ctaHref: "/courses/hermeneutica-como-interpretar-a-biblia" },
      { placement: "HOME_HERO", position: 2, eyebrow: "Para líderes", title: "Liderança Servidora", subtitle: "Caráter, equipes e cuidado com pessoas: forme-se para servir melhor no seu ministério.", ctaLabel: "Começar agora", ctaHref: "/courses/lideranca-servidora" },
      { placement: "DASHBOARD", position: 0, eyebrow: "Evento", title: "Semana de formação de líderes · 10 a 12 de outubro", subtitle: "Encontros presenciais para alunos de Liderança e Discipulado.", ctaLabel: "Ver comunicado", ctaHref: "/announcements" },
    ],
  });
  await db.setting.createMany({
    data: [
      {
        key: "home",
        value: {
          featuredCourseIds: built.filter((b) => COURSES.find((c) => c.slug === b.slug)?.featured).map((b) => b.id),
          testimonials: TESTIMONIALS,
          benefits: BENEFITS,
        },
      },
    ],
  });

  // ── Auditoria inicial ─────────────────────────────────
  await db.auditLog.createMany({
    data: [
      { actorId: admin.id, action: "settings.updated", entityType: "setting", entityId: "appearance", createdAt: daysAgo(30) },
      { actorId: teachers[0].id, action: "course.submitted_for_review", entityType: "course", entityId: built[7].id, createdAt: daysAgo(3) },
      { actorId: admin.id, action: "banner.created", entityType: "banner", createdAt: daysAgo(20) },
      { actorId: managers[0].id, action: "report.exported", entityType: "report", entityId: "enrollments", createdAt: daysAgo(1) },
      { actorId: ana.id, action: "auth.login", entityType: "user", entityId: ana.id, createdAt: daysAgo(0, 3) },
    ],
  });

  console.log("\n✓ Seed concluído.");
  console.log("  Contas (senha Demo@2026): aluno@demo.eba · professor@demo.eba · gestor@demo.eba · admin@demo.eba");
  console.log("  Certificado demo: /certificate/EBA-2026-DEMO-7K3P");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
