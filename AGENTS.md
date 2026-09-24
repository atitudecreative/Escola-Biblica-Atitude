<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Escola Bíblica Atitude — convenções do projeto

Plataforma EAD/LMS. Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript estrito · Tailwind CSS v4 · Prisma 6 + PostgreSQL · Radix UI · Zod · Recharts.
Idioma da interface: **português do Brasil**. Código (nomes) em inglês; comentários em português.

## Arquitetura
- `prisma/schema.prisma` — modelo de dados (fonte da verdade). Mudou o schema? `npx prisma migrate dev --name <nome>`.
- `src/server/**` — código só-servidor (`import "server-only"`). Nunca importe isso em componentes client.
  - `services/<domínio>.ts` — regras de negócio + autorização. **Toda** leitura/escrita sensível passa por um serviço que verifica permissão (`assertPermission`, `canManageCourse`, `lessonAccess`...). Nunca confie na UI.
  - `auth/guards.ts` — `requireUserPage`/`requirePermissionPage` (páginas) e `assertUser`/`assertPermission` (actions/serviços).
  - `action.ts` — `runAction(name, fn, successMsg)` + `parseInput(zodSchema, input)`; retorna `ActionResult` (`{ok,data,message}|{ok:false,error,fieldErrors}`).
  - `audit.ts` (`audit(action, {actorId, entityType, entityId, metadata})`), `services/notifications.ts` (`notify`), `email/` (outbox), `storage/` (`saveUpload(file, purpose, ownerId)`), `settings.ts` (`getSettings(group)`), `rate-limit.ts`.
- `src/lib/**` — isomórfico: `permissions.ts` (catálogo RBAC), `labels.ts` (rótulos/tons de enums), `format.ts` (datas/números pt-BR), `utils.ts` (`cn`, `slugify`), `validation/*` (schemas Zod compartilhados).
- Server Actions ficam em `actions.ts` ao lado da rota (`"use server"`), finas: validam com Zod, chamam o serviço, `revalidatePath`/`refresh()`.
- No client use `useAction(action, {errorToast})` (`src/hooks/use-action.ts`) → `{run, pending, error, fieldErrors}`.
- Rotas: `(auth)` login/cadastro; `(app)` área logada e `(public)` site, ambos no mesmo `AppShell` (público usa `bare`; visitante vê `PUBLIC_NAV`, logado a sidebar por perfil de `components/layout/nav-config.ts`); `learn/` player imersivo.
- Sidebar: expandida 248px ↔ trilho 72px (`Ctrl+B`, cookie `SIDEBAR_COOKIE`, lido no servidor); tablet é sempre trilho; celular usa gaveta + barra inferior. Classes `sb-label`/`sb-rail`/`sb-only-*` em `globals.css`.
- Home (`(public)/(home)`): hero = primeiro banner ativo + sumário do curso divulgado; cursos em `components/home/course-showcase.tsx` (card expande em painel com FLIP; reusa `EnrollButton`).
- Next 16: `params`/`searchParams` são Promises (`PageProps<"/rota/[id]">`); `proxy.ts` (não middleware).

## Design system (src/components/ui) — reutilize, não duplique
Button (variants primary/secondary/outline/ghost/danger/danger-ghost/link; `loading`; `asChild`), Input/Textarea/NativeSelect, Field (label+hint+erro com ARIA), Select (Radix), Checkbox/Switch/RadioGroup, Dialog/DialogContent(footer), Drawer, useConfirm (ações destrutivas SEMPRE confirmam), DropdownMenu, Tooltip, Popover, Tabs/Segmented, Accordion, Badge (tons de `labels.ts`), Avatar/AvatarStack, Progress/ProgressRing, Alert, EmptyState (nunca tela vazia), PageHeader/SectionHeader, Breadcrumbs, Table/THead/TBody/TR/TH/TD, Pagination (URL), StatCard/StatStrip, Skeleton, toast (`@/components/ui/toaster`).
Dados: `components/data` → TableToolbar (busca/filtros na URL), SortHeader/buildHref/pageParam/strParam, BulkSelectProvider/RowCheckbox/BulkBar.
Gráficos: `components/charts/charts.tsx` → ChartFrame + TrendChart/ColumnChart/BarList (cores `--series-1..5`, nunca por ranking).
Cursos: `components/course` → CourseCover (arte gerada se não houver capa), CourseCard. Conteúdo rico: `components/markdown.tsx` (seguro contra XSS).
Tokens (use só estes): `bg-bg bg-surface bg-surface-2 bg-surface-3 border-border border-border-strong text-fg text-muted text-subtle`, `primary(-soft|-fg)`, `accent(-soft)`, `success|warning|danger|info(-soft)`. Tipografia: `text-display text-h1..h4 text-body text-small text-caption text-overline font-display`.

## Regras de UX
- Toda tela: loading (`loading.tsx` com Skeleton), empty state com CTA, erro amigável, sucesso (toast), confirmação em ações destrutivas.
- Mobile de verdade: tabelas têm alternativa em lista/cards `md:hidden`; alvos de toque ≥ 40px; nada de scroll horizontal da página.
- Hierarquia: contexto → título → informação principal → ação principal → secundárias. Evite excesso de cards, gradientes, emojis, sombras fortes.
- Não finja funcionalidades: se algo depende de integração externa, isole e informe claramente.

## Verificação
`npx tsc --noEmit` · `npx eslint <arquivos>` · dados demo: `npm run db:seed` (senha `Demo@2026`: aluno@ / professor@ / gestor@ / admin@demo.eba).
QA visual: `CHROME=/opt/pw-browsers/chromium node scripts/shot.mjs <aluno|professor|gestor|admin|-> /tmp/claude-0/shots/<nome> /rota1 /rota2` (env W/H, THEME=dark, FULL=1).
QA automatizado (servidor rodando em :3000): `node scripts/qa/crawl.mjs [aluno professor gestor admin]` (todas as rotas da navegação, desktop + 390px: status, erros de console, overflow) · `node scripts/qa/auth-flow.mjs` (cadastro → recuperação → redefinição → login) · `scripts/qa/player.mjs`, `quiz.mjs`, `search.mjs`, `home.mjs <prefixo> [largura] [perfil|-]` (expansão do card, foco, Esc). Testes unitários: `npm test`.
