# ai-workspace-lab

Modular monolith for **AI Workspace SaaS + Desktop Companion**. Users upload documents, ask AI questions, get cited answers. Apps in `apps/`, shared code in `packages/`.

Full spec: [`docs/product/prd.md`](./docs/product/prd.md) · Routes: [`docs/product/frontend-page-map.md`](./docs/product/frontend-page-map.md) · Agent contract: [`CLAUDE.md`](./CLAUDE.md)

> **Current status:** Sprint 1 — Auth + tenant boundary done. See [`docs/contexts/README.md`](./docs/contexts/README.md) for the full done/in-progress/upcoming list.

---

## Prerequisites

- **Node ≥ 22.17** (`nvm use` picks it up from `.nvmrc`)
- **pnpm ≥ 10.4** (`corepack enable` installs the pinned version)
- **Docker Desktop** — required for local Supabase only

```bash
nvm use
corepack enable
pnpm install
```

---

## Environment setup

Copy `.env.example` to `.env.local` and fill in the values. Sprint labels in `.env.example` tell you when each var becomes required. The minimum needed to run the app now:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Database: local vs cloud

### Local Supabase (recommended for development)

Runs Postgres + Auth + Studio in Docker. No internet required. DB is throwaway — reset freely.

```bash
pnpx supabase start          # starts Docker stack; prints URLs + keys on first run
pnpx supabase status         # print URLs + keys any time after start
```

Copy the printed values into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

Then apply migrations and start the app:

```bash
pnpm --filter @ai-workspace-lab/db db:migrate
pnpm dev
```

Studio (table viewer + SQL editor) runs at `http://localhost:54323`.

### Cloud Supabase

Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Get credentials from **Project Settings → API** and **Project Settings → Database → Connection string**.

> Use **transaction mode** (port 6543) for `DATABASE_URL` with Next.js. Session mode (port 5432) is fine for migration scripts.

Fill `.env.local` with the project URL, anon key, service role key, and database URL, then:

```bash
pnpm --filter @ai-workspace-lab/db db:migrate
pnpm dev
```

---

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps |
| `pnpm verify` | Full CI gate: lint + typecheck + test — must pass before push |
| `pnpm lint` | Lint and format-check (Biome) |
| `pnpm lint:fix` | Auto-fix lint and format issues |
| `pnpm typecheck` | TypeScript type-check all packages |
| `pnpm test` | Unit tests (Vitest) — no DB required |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm e2e:install` | Install Playwright browsers (one-time) |
| `pnpx supabase start` | Start local Supabase (Docker) |
| `pnpx supabase stop` | Stop local Supabase |
| `pnpx supabase db reset` | Wipe local DB and re-run all migrations |
| `pnpm --filter @ai-workspace-lab/db db:migrate` | Apply pending migrations |
| `pnpm --filter @ai-workspace-lab/db db:generate` | Generate migration from schema changes |

---

## Local verification checklist

Run this sequence after pulling a branch or completing a feature to confirm everything works end-to-end.

**Prerequisites:** Docker Desktop must be running before step 1.

```bash
# 1. Start local Supabase (first run pulls Docker images — takes ~60s)
pnpx supabase start

# If it was already running but stuck:
pnpx supabase stop && pnpx supabase start

# 2. Copy env (first time only) and fill in values from `pnpx supabase status`
cp .env.example .env.local
#   Required minimum:
#   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
#   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
#   NEXT_PUBLIC_APP_URL=http://localhost:3000

# 3. Apply all pending DB migrations
pnpm --filter @ai-workspace-lab/db db:migrate

# 4. (Optional) Seed plan data + Stripe price IDs
#   Set STRIPE_PRO_MONTHLY_PRICE_ID and STRIPE_PRO_YEARLY_PRICE_ID in .env.local first
pnpm --filter @ai-workspace-lab/db db:seed

# 5. Run unit tests (no DB needed)
pnpm test

# 6. Run integration tests (requires steps 1–3)
pnpm test:integration

# 7. Start the web app
pnpm dev
#   Web app → http://localhost:3000
#   Supabase Studio (table viewer) → http://localhost:54323

# 8. Full CI gate — must be green before push
pnpm verify
```

**Verify a specific feature's DB changes:**

```bash
# Inspect a table's columns and constraints
pnpx supabase db psql -c "\d <table_name>"

# Wipe local DB and re-apply all migrations from scratch
pnpx supabase db reset
```

---

## Tests

**Unit tests** run without a database:

```bash
pnpm test
```

**Integration tests** (`*.integration.test.ts`) require a live Postgres. They are skipped automatically when `DATABASE_URL` is not set. To run them:

```bash
# Local
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres pnpm test

# Cloud (use session mode / port 5432 for direct connections)
DATABASE_URL=postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres pnpm test
```

---

## Repo layout

```
ai-workspace-lab/
├── apps/
│   ├── web/                   # Next.js 15 + Tailwind — main product
│   ├── desktop/               # Electron companion (scaffold)
│   └── e2e/                   # Playwright suite
├── packages/
│   ├── config/                # shared tsconfig presets
│   ├── types/                 # shared TS types (no runtime code)
│   ├── ui/                    # shared UI primitives
│   ├── db/                    # Drizzle ORM client + migrations
│   ├── auth/                  # auth helpers (scaffold)
│   ├── billing/               # Stripe billing + webhooks (scaffold)
│   ├── entitlements/          # plan/quota enforcement (scaffold)
│   ├── ai/                    # Vercel AI SDK + Anthropic helpers (scaffold)
│   ├── jobs/                  # async queue + retries (scaffold)
│   ├── email/                 # Resend transactional email (scaffold)
│   └── analytics/             # PostHog event taxonomy (scaffold)
├── docs/
│   ├── product/               # PRD, ERD, frontend page map, sprint plan
│   ├── adr/                   # architecture decision records
│   ├── contexts/              # living summaries for AI agents
│   ├── runbooks/              # incident response, ops procedures
│   └── journal/               # how we built each phase
├── CLAUDE.md                  # contract for AI agents working in this repo
├── .env.example               # all env vars with sprint labels
├── biome.json                 # lint + format config
└── turbo.json                 # Turborepo pipeline
```

> Packages marked *(scaffold)* have a `package.json` and placeholder `src/index.ts` but no logic yet. Implementation lands per-sprint per [`CLAUDE.md`](./CLAUDE.md).

---

## Stack (locked — changing any layer requires a new ADR)

| Layer | Choice |
|-------|--------|
| Web framework | Next.js 15 App Router + React 19 |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth |
| Payments | Stripe Checkout + Customer Portal |
| Email | Resend |
| Errors | Sentry |
| Analytics + flags | PostHog |
| Cache + rate limit + jobs | Upstash Redis + QStash |
| Object storage | Cloudflare R2 |
| AI | Vercel AI SDK + Anthropic Claude |
| Vector | pgvector in Supabase |
| Lint + format | Biome |
| Tests | Vitest (unit) + Playwright (e2e) |
| Monorepo | pnpm workspaces + Turborepo |

Full rationale: [`docs/adr/0001-stack-choice.md`](./docs/adr/0001-stack-choice.md)

---

## Conventions

- **Branches:** `feature/*`, `fix/*`, `chore/*`, `docs/*`, `adr/*`. Never commit to `main`.
- **Commits:** conventional prefix: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- **PRs:** `pnpm verify` must be green. New routes → update `frontend-page-map.md`. New tables → update ERD.
- **TS:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — all on. No `any`.
- **AI agents:** read [`CLAUDE.md`](./CLAUDE.md) before changing anything.
