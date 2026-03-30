# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com o codigo deste repositorio.

## Visao Geral

API de treinos construida com Fastify 5, TypeScript, Prisma 7 e Better-Auth. Roda em Node.js 24.x com pnpm 10.30.0 (ambos obrigatorios via `engine-strict`).

## Comandos

```bash
# Iniciar servidor de desenvolvimento (hot-reload na porta 8081)
pnpm dev

# Iniciar PostgreSQL
docker-compose up -d

# Migrations do Prisma
pnpm exec prisma migrate dev
pnpm exec prisma generate

# Lint
pnpm exec eslint .

# Formatacao
pnpm exec prettier --write .
```

Nao ha script de build ou teste configurado ainda. TypeScript compila para `./dist` via `tsc`.

## Arquitetura

### Padrao em camadas: Routes → Use Cases → Prisma

- **Routes** (`src/routes/`) — Handlers de rotas Fastify. Registram schemas Zod para validacao de request/response via `fastify-type-provider-zod`. Extraem sessao de autenticacao e definem status HTTP.
- **Use Cases** (`src/usecases/`) — Classes de logica de negocio. Recebem DTOs, usam transacoes Prisma para atomicidade (ex: desativar planos ativos antes de criar novos). Uma classe por caso de uso.
- **Schemas** (`src/schemas/`) — Schemas Zod compartilhados entre rotas e OpenAPI docs. Definem tanto validacao de entrada quanto formato de resposta.
- **Errors** (`src/errors/`) — Classes de erro customizadas (ex: `NotFoundError`) usadas nos use cases e tratadas nas rotas.

### Autenticacao

Better-Auth com adaptador Prisma (`src/lib/auth.ts`). Rotas de auth em `/api/auth/*`. Autenticacao baseada em sessao — rotas extraem a sessao do usuario via `auth.api.getSession()`.

### Banco de Dados

PostgreSQL 16 via Docker. Prisma client inicializado em `src/lib/db.ts`. Tipos gerados em `src/generated/prisma/` (gitignored). Schema em `prisma/schema.prisma`.

### Documentacao da API

Swagger JSON em `/swagger.json`, Scalar UI em `/docs`. Endpoints de auth sao mesclados no spec OpenAPI via plugin do Better-Auth.

## Convencoes

- **TypeScript strict** com target ES2024 e module resolution `nodenext`
- **ESLint** com typescript-eslint, integracao com prettier e `simple-import-sort` (imports devem ser ordenados)
- **Zod 4** para validacao (usa padrao `z.interface()`, nao `z.object()`)
- **CORS** permite `http://localhost:3000` com credentials
- Variaveis de ambiente: `PORT`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

## Rules

Detailed coding rules are in `.claude/rules/`:

- `architecture.md` — route and use case patterns with examples
- `typescript.md` — TypeScript conventions, naming, Zod usage
- `general.md` — stack overview, commands, MCP usage
