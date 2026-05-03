# CLAUDE.md — operating guide for AI agents in `ai-workspace-lab`

This file is the contract between you (the AI agent) and this monorepo. Read it before changing anything.

## Repository

`ai-workspace-lab` is a personal monorepo for indie AI products. Apps live under `apps/`, shared code under `packages/`. Managed by **pnpm workspaces + Turborepo**.

## Stack lock-in

The default stack is fixed by [`docs/adr/0001-stack-choice.md`](./docs/adr/0001-stack-choice.md). **Do not bikeshed it.** If a switch is needed, write a new ADR with a real reason — never silently swap a layer.

## Commands

All commands run from the repo root.

| Purpose                        | Command             |
| ------------------------------ | ------------------- |
| Install deps                   | `pnpm install`      |
| Lint + format check (Biome)    | `pnpm lint`         |
| Lint + format auto-fix         | `pnpm lint:fix`     |
| Format only (write)            | `pnpm format`       |
| Format only (check)            | `pnpm format:check` |
| Typecheck (all workspaces)     | `pnpm typecheck`    |
| Tests (one-shot, vitest)       | `pnpm test`         |
| Tests (watch)                  | `pnpm test:watch`   |
| e2e (Playwright)               | `pnpm e2e`          |
| Install Playwright browsers    | `pnpm e2e:install`  |
| Build (all)                    | `pnpm build`        |
| Dev (all apps)                 | `pnpm dev`          |
| Full CI gate (run before push) | `pnpm verify`       |

The CI gate (`pnpm verify`) runs lint → typecheck → test. **A change is not done until `pnpm verify` is green.** (Note: `ci` is a reserved pnpm built-in, so the script is named `verify`. e2e tests are not part of `verify` — they run in their own CI job; trigger locally with `pnpm e2e`.)

Lint + format are unified under [Biome](https://biomejs.dev/) (replaces ESLint + Prettier — see [learning-journal 0002](./docs/learning_journal/0002-tooling-switch-to-biome-and-playwright.md)).

## Branch naming

```
<type>/<short-kebab-description>
```

- `feature/` — new functionality
- `fix/` — bug fix
- `chore/` — build, deps, tooling, refactors with no behavior change
- `docs/` — docs-only
- `adr/` — adding or revising an ADR

Examples: `feature/auth-supabase`, `fix/quota-off-by-one`, `chore/turbo-cache`, `adr/0004-billing`.

Never commit to `main`. Always work on a branch and open a PR.

## ADR location

Architecture Decision Records live in [`docs/adr/`](./docs/adr/), numbered sequentially: `0001-…md`, `0002-…md`, etc. Use the format:

```
# NNNN — Title

## Status
Proposed | Accepted | Superseded by NNNN

## Context
Why this decision is being made now.

## Decision
The choice, in plain language.

## Consequences
Trade-offs accepted, follow-up work, what we will need to monitor.
```

Any change that locks in a stack layer, security model, data shape, or cross-package contract requires an ADR.

## Do-not-change-without-test boundaries

These modules carry production-shaped invariants. **Do not modify them without first adding or updating a test that demonstrates the change is correct.** If a test does not yet exist, write one before the change.

| Boundary                                             | Reason                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/types/src/**`                              | Shared types are a cross-package contract. Breakage cascades.       |
| Anything named `*entitlement*`, `*quota*`, `*authz*` | Server-side trust. A wrong unlock is a paying-customer incident.    |
| Anything named `*webhook*` (especially Stripe)       | Idempotency invariants. Duplicate effects are real money.           |
| Anything named `*job*`, `*queue*`, `*retry*`         | Failure-mode behavior. Wrong retry = duplicate cost or silent loss. |
| Migration files (`packages/db/**/migrations/**`)     | Once shipped, irreversible. Write the test against the migration.   |
| `biome.json`, `tsconfig.base.json`                   | Affects every package. A loosening must be justified in PR.         |

## Engineering rules

1. **Strict TS, no `any`.** `noUncheckedIndexedAccess` is on. Arrays returns may be `undefined` — handle it.
2. **No silent failures.** Every error path either returns a typed error or throws. No `catch {}`.
3. **Server owns trust.** Auth, authorization, entitlements, and quotas are checked **server-side**, not in the client.
4. **Async by default for expensive work.** Anything that could block a user request for >1s belongs on a queue.
5. **Every expensive action is measured.** Usage events feed quotas, billing, and observability — not optional.
6. **Managed services first, primitives understood.** Use Supabase / Stripe / Sentry — but write the ADR that explains the underlying contract.

## What lives where

```
ai-workspace-lab/
├── apps/                      # one folder per product
├── packages/
│   ├── config/                # shared eslint, prettier, tsconfig presets
│   ├── types/                 # shared TS types (no runtime code)
│   └── ui/                    # shared UI primitives
├── docs/
│   └── adr/                   # architecture decision records
├── learning-journal.md        # weekly reflection — you must keep this updated
├── CLAUDE.md                  # this file
└── README.md                  # human-facing quickstart
```

## When in doubt

- **Stop, do not improvise on stack or boundaries.** Open an ADR or ask.
- **Re-read this file at the start of any non-trivial change.**
- **A green `pnpm ci` is not optional.**
