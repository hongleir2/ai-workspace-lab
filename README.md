# ai-workspace-lab

Personal monorepo for indie AI products. Apps live in `apps/`, shared code in `packages/`.

> **Phase 0 status:** Foundation only. No products yet. The amplifier comes first.

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
├── apps/                      # products (none yet)
├── packages/
│   ├── config/                # @ai-workspace-lab/config — tsconfig.base.json (Biome lives at root)
│   ├── types/                 # @ai-workspace-lab/types — shared TS types
│   └── ui/                    # @ai-workspace-lab/ui — shared UI primitives
├── docs/adr/                  # architecture decision records (0001 = stack lock-in)
├── learning-journal.md        # weekly engineering journal
├── CLAUDE.md                  # contract for AI agents working in this repo
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json              # extends @ai-workspace-lab/config/tsconfig.base.json
```

## Tooling

Lint + format: **Biome** (single binary; replaces ESLint + Prettier — see [learning-journal 0002](./docs/learning_journal/0002-tooling-switch-to-biome-and-playwright.md)). Unit tests: **Vitest**. e2e: **Playwright** at `apps/e2e/`. Workspace orchestration: **pnpm + Turborepo**.

## Stack (locked — see [ADR 0001](./docs/adr/0001-stack-choice.md))

Web Next.js 15 · DB Supabase Postgres · Auth Supabase Auth · Payments Stripe · Email Resend · Errors Sentry · Analytics + flags PostHog · Cache + ratelimit Upstash Redis · Object store Cloudflare R2 · AI Vercel AI SDK + Anthropic Claude · Vector pgvector

Switching a stack layer requires a new ADR.

## Commands

|                                     |                                                        |
| ----------------------------------- | ------------------------------------------------------ |
| `pnpm install`                      | install all workspaces                                 |
| `pnpm lint` / `pnpm lint:fix`       | Biome lint + format check / auto-fix                   |
| `pnpm format` / `pnpm format:check` | Biome format write / check                             |
| `pnpm typecheck`                    | TS in every workspace                                  |
| `pnpm test` / `pnpm test:watch`     | Vitest unit tests                                      |
| `pnpm e2e` / `pnpm e2e:install`     | Playwright e2e / install browsers                      |
| `pnpm verify`                       | the full gate — lint → typecheck → test                |
| `pnpm dev`                          | run every app's dev server                             |
| `pnpm build`                        | build every app/package                                |

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
