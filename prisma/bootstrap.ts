/**
 * Inicialização de produção: `npm run db:bootstrap`
 *
 * Idempotente e NÃO apaga dados. Cria/atualiza perfis, permissões e conquistas
 * e, se ADMIN_EMAIL e ADMIN_PASSWORD estiverem definidos, cria o primeiro
 * administrador (ou garante o perfil admin a um usuário existente).
 * Perfis personalizados e ajustes feitos no admin são preservados: permissões
 * padrão só são acrescentadas, nunca removidas.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLE_KEYS, ROLE_LABELS } from "../src/lib/permissions";
import { email as emailSchema, password as passwordSchema } from "../src/lib/validation/auth";
import { ACHIEVEMENTS } from "./seed-data";

const db = new PrismaClient();

const ROLE_DESCRIPTIONS = {
  student: "Consome cursos, participa da comunidade e conversa com professores.",
  teacher: "Cria e administra cursos, corrige atividades e acompanha turmas.",
  manager: "Acompanha indicadores, relatórios, alunos e professores.",
  admin: "Controle completo da plataforma.",
};

async function main() {
  console.log("→ Permissões");
  for (const [key, v] of Object.entries(PERMISSIONS)) {
    await db.permission.upsert({ where: { key }, create: { key, group: v.group, description: v.description }, update: { group: v.group, description: v.description } });
  }
  const permId = new Map((await db.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]));

  console.log("→ Perfis");
  const roles: Record<string, string> = {};
  for (const key of ROLE_KEYS) {
    const role = await db.role.upsert({
      where: { key },
      create: { key, name: ROLE_LABELS[key], description: ROLE_DESCRIPTIONS[key] },
      update: {},
    });
    roles[key] = role.id;
    await db.rolePermission.createMany({
      data: DEFAULT_ROLE_PERMISSIONS[key].map((p) => ({ roleId: role.id, permissionId: permId.get(p)! })),
      skipDuplicates: true,
    });
  }

  console.log("→ Conquistas");
  for (const a of ACHIEVEMENTS) {
    await db.achievement.upsert({ where: { key: a.key }, create: a, update: {} });
  }

  const rawEmail = process.env.ADMIN_EMAIL;
  const rawPassword = process.env.ADMIN_PASSWORD;
  if (!rawEmail || !rawPassword) {
    console.log("→ ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhum administrador criado.");
  } else {
    const email = emailSchema.parse(rawEmail);
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      await db.userRole.createMany({ data: [{ userId: existing.id, roleId: roles.admin }], skipDuplicates: true });
      console.log(`→ ${email} já existia: perfil de administrador garantido (senha mantida).`);
    } else {
      const parsed = passwordSchema.safeParse(rawPassword);
      if (!parsed.success) throw new Error(`ADMIN_PASSWORD inválida: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      const passwordHash = await hash(parsed.data, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
      await db.user.create({
        data: {
          email,
          name: process.env.ADMIN_NAME?.trim() || "Administrador",
          passwordHash,
          emailVerifiedAt: new Date(),
          roles: { create: [{ roleId: roles.admin }] },
        },
      });
      console.log(`→ Administrador ${email} criado. Remova ADMIN_PASSWORD do ambiente após o primeiro acesso.`);
    }
  }
  console.log("✓ Bootstrap concluído.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
