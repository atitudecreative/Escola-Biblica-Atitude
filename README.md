# Escola Bíblica Atitude — Plataforma EAD

Plataforma de ensino a distância (LMS) da Igreja Batista Atitude: cursos com módulos e aulas, player próprio, avaliações, atividades com correção, certificados validáveis por QR Code, comunicação entre alunos, professores e gestão, comunidade, relatórios e um painel administrativo com CMS.

> Tudo que aparece na interface funciona de verdade. Integrações externas que ainda não estão configuradas (gateway de pagamento, login social, WhatsApp, S3) estão **preparadas na arquitetura e sinalizadas como “não configurado”** — nenhuma finge funcionar.

---

## Início rápido

Pré-requisitos: **Node.js 20.9+** e **PostgreSQL 14+** (com as extensões `unaccent` e `pg_trgm`, que vêm no pacote padrão).

```bash
cp .env.example .env            # ajuste DATABASE_URL e SESSION_SECRET
npm install
npx prisma migrate deploy       # cria as tabelas
npm run db:seed                 # dados de demonstração (apaga o banco!)
npm run dev                     # http://localhost:3000
```

### Contas de demonstração

Senha de todas: `Demo@2026` (defina `DEMO_MODE="true"` para exibi-las na tela de login).

| Perfil | E-mail | O que ver |
|---|---|---|
| Aluno | `aluno@demo.eba` | Dashboard, player, avaliações, certificados, mensagens |
| Professor | `professor@demo.eba` | Painel do professor, construtor de cursos, correções |
| Gestor | `gestor@demo.eba` | Indicadores, relatórios, alunos e professores |
| Administrador | `admin@demo.eba` | Tudo, incluindo CMS, permissões e logs |

Certificado de exemplo para validação pública: `/certificate/EBA-2026-DEMO-7K3P`.

---

## Stack e decisões

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 16** (App Router, React 19, Turbopack) | SSR/SEO na área pública, Server Components e Server Actions reduzem API boilerplate |
| Linguagem | TypeScript estrito | Tipos de ponta a ponta (Prisma → serviços → UI) |
| Banco | **PostgreSQL + Prisma 6** | Modelo relacional rico (~50 tabelas), migrações versionadas |
| UI | Tailwind CSS v4 + Radix UI + design system próprio | Acessibilidade dos primitivos Radix, visual 100% próprio via tokens |
| Validação | Zod (compartilhado cliente/servidor) | Uma única fonte de regras |
| Gráficos | Recharts com paleta validada (daltonismo/contraste) | |
| Auth | Sessões próprias em banco + Argon2id | Controle total (revogação, sessões ativas, "lembrar acesso") sem dependência externa |

Monólito modular: a separação de camadas permite extrair serviços no futuro sem reescrever a UI.

```
src/
  app/
    (public)/      site: home, catálogo, página do curso, professor, validação de certificado
    (auth)/        login, cadastro, recuperação/redefinição de senha, verificação de e-mail
    (app)/         área logada (AppShell): aluno, professor (/teacher), gestor (/manager), admin (/admin)
    learn/         player imersivo de aulas
    api/           uploads, arquivos (com Range), PDF de certificado, exportações CSV
  server/          só servidor: auth, guards, serviços de domínio, e-mail, storage, settings, auditoria
  components/      ui/ (design system), layout/, course/, charts/, data/, learn/, ...
  lib/             isomórfico: permissões, rótulos, formatação pt-BR, validações
prisma/            schema, migrações e seed
scripts/           QA visual e testes end-to-end (Playwright)
```

Convenções detalhadas para quem for desenvolver: **[AGENTS.md](./AGENTS.md)**.

---

## Funcionalidades

**Aluno** — dashboard personalizado (continuar de onde parou, indicadores, sequência de estudo, próximas atividades, recomendações, conquistas), catálogo com busca e filtros, página do curso completa, player com velocidade/legendas/PiP/tela cheia/atalhos e retomada, conclusão automática e liberação sequencial, materiais, comentários, avaliações (5 tipos de questão, tempo, tentativas, feedback), atividades com envio de arquivo, certificados em PDF com QR Code, favoritos, mensagens, notificações, comunidade, perfil e preferências.

**Professor** — painel com métricas e gráficos, construtor de cursos com arrastar-e-soltar (mouse, toque e teclado), editor de aulas de 9 tipos, editor de questionários e atividades, envio para revisão/publicação, alunos por curso, fila de correção, comunicados para turmas.

**Gestor** — indicadores com filtro de período e comparação com período anterior, 10 relatórios com gráficos, tabela e exportação CSV (compatível com Excel), impressão/PDF, alunos e professores com páginas individuais.

**Administrador** — usuários (criar, editar perfis, bloquear, redefinir senha, ações em massa), cursos (fila de revisão, publicação em massa, destaques), categorias e tags, banners e home (CMS), certificados (modelos, revogação, emissão manual), configurações (marca, cores com checagem de contraste, tema, regras, segurança, integrações e webhooks reais), matriz de permissões (RBAC granular + perfis personalizados), logs de auditoria, caixa de saída de e-mails e entregas de webhook.

**Transversal** — busca global agrupada (⌘K) que ignora acentos, dark mode com preferência do sistema, layouts responsivos reais (drawer, barra inferior no celular, listas no lugar de tabelas), estados de loading/vazio/erro/sucesso em todas as telas, gamificação (XP, níveis, conquistas, sequência), SEO (metadata, Open Graph, JSON-LD, sitemap, robots), manifesto PWA.

---

## Segurança

- Senhas com **Argon2id**; tokens (sessão, reset, verificação) guardados apenas como hash SHA-256.
- Cookies `httpOnly`, `SameSite=Lax`, `Secure` em produção; sessões revogáveis; troca/redefinição de senha encerra as outras sessões.
- **Autorização sempre no servidor** (guards + serviços); a UI apenas esconde o que o usuário não pode fazer.
- Server Actions com checagem de origem nativa; Route Handlers mutáveis exigem `Origin` válido (CSRF).
- Rate limiting em login, cadastro, recuperação de senha, uploads, mensagens e comunidade.
- Uploads com lista de tipos por finalidade, verificação de assinatura binária (magic bytes), limite de tamanho e SVG sem scripts; arquivos privados servidos só com vínculo (matrícula, autoria, participação na conversa).
- Markdown renderizado sem HTML bruto (proteção contra XSS); links externos com `rel="noopener noreferrer nofollow"`.
- CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` configurados em `next.config.ts`.
- Prevenção de enumeração de contas (mesma resposta e tempo) e de open redirect (`?next=`).
- Exportações CSV protegidas contra injeção de fórmula; auditoria de ações sensíveis.
- Segredos apenas em variáveis de ambiente, validadas na inicialização (`src/server/env.ts`).

## Observabilidade

Logs estruturados em JSON (`src/server/logger.ts`) com categoria **user / app / infra**, prontos para qualquer agregador. Trilha de auditoria em `audit_logs`, caixa de saída de e-mails (`email_outbox`) e histórico de webhooks, todos visíveis em **Admin › Logs**.

## Integrações

| Integração | Estado |
|---|---|
| E-mail | **Funcional**: `EMAIL_PROVIDER=log` (grava e não envia), `resend` ou `smtp` |
| Webhooks | **Funcional**: endpoints com assinatura HMAC-SHA256 (`X-EBA-Signature`) em Admin › Configurações › Integrações |
| Google Analytics 4 / Meta Pixel | **Funcional**: informe os IDs no admin |
| Armazenamento | Disco local; interface `StorageDriver` pronta para S3/R2/GCS |
| Pagamentos | Modelo (`orders`, `coupons`, preço do curso) pronto; sem gateway — cursos pagos mostram "inscrição indisponível" |
| Login Google/Microsoft | Tabela `oauth_accounts` pronta; provedores não ativados |
| WhatsApp, push, offline | Preparado (notificações por canal, manifesto PWA); não implementado |

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run typecheck` · `npm run lint` · `npm test` | Tipos, lint e testes unitários |
| `npm run db:migrate` | Aplica migrações (produção) |
| `npm run db:bootstrap` | Produção: perfis, permissões e primeiro admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`); idempotente, não apaga dados |
| `npm run db:seed` | Recria os dados de demonstração (**apaga o banco**) |
| `node scripts/qa/crawl.mjs` | QA automatizado de todas as rotas por perfil (desktop + mobile) |

## Deploy

### Render (recomendado)

O `render.yaml` na raiz cria o serviço web com disco persistente para uploads; o banco é o **Supabase**.

**Supabase**
1. Crie o projeto na região mais próxima do Render (Virginia → `us-east-1`).
2. **Não** ative `unaccent`/`pg_trgm` pelo painel: a migração cria as extensões no schema `public`, onde a busca as espera.
3. Em **Project Settings → Data API**, desative a API ou remova `public` dos schemas expostos — o app não a usa e as tabelas não devem ficar acessíveis por REST.
4. Em **Connect**, copie a string do **Session pooler** (porta 5432) e acrescente `?connection_limit=5`. A conexão direta é só IPv6 (o Render não alcança) e o Transaction pooler (6543) quebra as migrações.
5. No plano gratuito o projeto pausa após 7 dias sem uso; para produção use o Pro e ative backups.

**Render**
1. **New → Blueprint** → selecione este repositório (branch `main`).
2. Preencha `DATABASE_URL` (string do Supabase acima), `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mín. 8 caracteres, com letra e número). `APP_URL` só é necessário com domínio próprio (sem ele, usa a URL `.onrender.com`); `RESEND_API_KEY` só para envio real de e-mails.
3. **Apply**. A cada deploy o pre-deploy roda `prisma migrate deploy` e `npm run db:bootstrap`.
4. Após o primeiro login, remova `ADMIN_PASSWORD` do ambiente.

Disco e pre-deploy exigem plano pago do serviço web. Para usar o Postgres do próprio Render, veja o bloco comentado no `render.yaml`. Nunca rode `db:seed` em produção.

### Outros provedores

1. PostgreSQL gerenciado com permissão para `CREATE EXTENSION unaccent, pg_trgm` (ou crie-as previamente).
2. Configure as variáveis do `.env.example` (nunca use `DEMO_MODE` ou `RATE_LIMIT_RELAXED` em produção).
3. `npm ci && npm run db:migrate && npm run db:bootstrap && npm run build && npm start`.
4. Para mais de uma instância: troque o armazenamento local por um driver S3 e o rate limit em memória por Redis (as interfaces já existem em `src/server/storage` e `src/server/rate-limit.ts`).
