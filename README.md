# ai-workspace-lab

Modular monolith for **AI Workspace SaaS + Desktop Companion**. Apps live in `apps/`, shared code in `packages/`. See [`docs/product/prd.md`](./docs/product/prd.md) for what we're building.

> **Phase 0 status:** Foundation + scaffolds only. No product features wired up yet.

## Quickstart

```bash
# requires Node ≥22.17 and pnpm ≥10.4
nvm use                # picks up .nvmrc
corepack enable        # makes the pinned pnpm available
pnpm install
pnpm verify            # format-check + lint + typecheck + test
```

## Layout

```
ai-workspace-lab/
├── apps/
│   ├── web/                   # @ai-workspace-lab/web — Next.js 15 + Tailwind (scaffold, no features)
│   ├── desktop/               # @ai-workspace-lab/desktop — companion app placeholder
│   └── e2e/                   # @ai-workspace-lab/e2e — Playwright suite
├── packages/
│   ├── config/                # tsconfig.base.json (Biome lives at root)
│   ├── types/                 # shared TS types
│   ├── ui/                    # shared UI primitives
│   ├── db/                    # Postgres / Supabase client + migrations (scaffold)
│   ├── auth/                  # auth + sessions (scaffold)
│   ├── billing/               # Stripe billing + webhooks (scaffold)
│   ├── entitlements/          # plan tiers, quotas, server-side trust (scaffold)
│   ├── ai/                    # Vercel AI SDK + Anthropic helpers (scaffold)
│   ├── jobs/                  # background queue + retries (scaffold)
│   ├── email/                 # Resend transactional email (scaffold)
│   └── analytics/             # PostHog event taxonomy + flags (scaffold)
├── docs/
│   ├── product/               # PRD, ERD — what we're building
│   ├── adr/                   # architecture decision records (0001 = stack lock-in)
│   ├── runbooks/              # incident response, ops procedures
│   ├── performance/           # budgets, capacity, cost ceilings
│   ├── studies/               # time-boxed investigations
│   └── journal/               # how we built the foundation
├── learning-journal.md        # weekly engineering reflection
├── CLAUDE.md                  # contract for AI agents working in this repo
├── biome.json                 # lint + format
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json              # extends @ai-workspace-lab/config/tsconfig.base.json
└── .env.example               # contract for env vars across all stack layers
```

> **Scaffold vs. implementation.** Every package above marked *(scaffold)* has a `package.json`, `tsconfig.json`, and a placeholder `src/index.ts` so workspace tooling sees it — but no logic. Implementation lands per-feature, gated by the rules in [`CLAUDE.md`](./CLAUDE.md) and [ADR 0001](./docs/adr/0001-stack-choice.md).

## Tooling

Lint + format: **Biome** (single binary; replaces ESLint + Prettier — see [journal 0002](./docs/journal/0002-tooling-switch-to-biome-and-playwright.md)). Unit tests: **Vitest**. e2e: **Playwright** at `apps/e2e/`. Workspace orchestration: **pnpm + Turborepo**.

## Stack (locked — see [ADR 0001](./docs/adr/0001-stack-choice.md))

Web Next.js 15 · DB Supabase Postgres · Auth Supabase Auth · Payments Stripe · Email Resend · Errors Sentry · Analytics + flags PostHog · Cache + ratelimit Upstash Redis · Object store Cloudflare R2 · AI Vercel AI SDK + Anthropic Claude · Vector pgvector

Switching a stack layer requires a new ADR.

## Development

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint and format-check (Biome) |
| `pnpm lint:fix` | Auto-fix lint and format issues |
| `pnpm typecheck` | TypeScript type-check all packages |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm e2e` | Run end-to-end tests (Playwright) |
| `pnpm verify` | Full CI gate: lint + typecheck + test |

## Conventions

- **Branches:** `feature/*`, `fix/*`, `chore/*`, `docs/*`, `adr/*`. Never commit to `main`.
- **Commits:** small, single-purpose. Reference the ADR if relevant.
- **PRs:** `pnpm verify` must be green before merge.
- **TS:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — all on. No `any`.
- **AI agents:** read [`CLAUDE.md`](./CLAUDE.md) before changing anything.

## Adding a new app

1. `mkdir apps/<name>` and add a `package.json` with `"name": "@ai-workspace-lab/<name>"`.
2. Extend `@ai-workspace-lab/config/tsconfig.base.json`.
3. Add `lint`, `typecheck`, `build`, `dev` scripts so Turborepo picks them up.
4. Open an ADR if the app introduces a stack layer not yet covered.

## Adding a shared package

1. `mkdir packages/<name>`, add `package.json` named `@ai-workspace-lab/<name>`.
2. Other packages depend on it via `"@ai-workspace-lab/<name>": "workspace:*"`.
