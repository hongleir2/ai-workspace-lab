# CLAUDE.md — operating guide for AI agents in `ai-workspace-lab`

This file is the contract between you (the AI agent) and this monorepo. **Read it before changing anything.** It is the source of truth for what to build, how to build it, and what is forbidden. The product spec is [`docs/product/prd.md`](./docs/product/prd.md); the data spec is [`docs/product/erd.md`](./docs/product/erd.md); the frontend route spec is [`docs/product/frontend-page-map.md`](./docs/product/frontend-page-map.md).

---

## 1. Project purpose

`ai-workspace-lab` is a modular monolith for an **AI Workspace SaaS + Desktop Companion**: an organization-scoped product where users upload documents, the system processes them into a vector index, and members ask AI questions over their documents with cited sources. A paid tier and a desktop companion app extend the core SaaS.

The repo is structured to grow feature-by-feature without a microservice rewrite. Apps live under `apps/`, shared logic under `packages/`. Managed by **pnpm workspaces + Turborepo**.

---

## 2. Stack assumptions (locked)

The default stack is fixed by [ADR 0001](./docs/adr/0001-stack-choice.md). **Do not bikeshed it.** If a switch is needed, write a new ADR with a real reason — never silently swap a layer.

| Layer                    | Choice                                |
| ------------------------ | ------------------------------------- |
| Web framework            | Next.js 15 (App Router) + React 19    |
| Styling                  | Tailwind 3.4                          |
| Database                 | Supabase Postgres (with `pgvector`)   |
| Auth                     | Supabase Auth                         |
| Payments                 | Stripe (Checkout + Customer Portal)   |
| Email                    | Resend                                |
| Errors                   | Sentry                                |
| Analytics + flags        | PostHog                               |
| Cache + ratelimit + jobs | Upstash Redis + QStash                |
| Object store             | Cloudflare R2                         |
| AI                       | Vercel AI SDK + Anthropic Claude      |
| Vector                   | `pgvector` in Supabase                |
| Desktop                  | TBD via ADR (Electron / Tauri / etc.) |
| Lint + format            | Biome                                 |
| Tests (unit)             | Vitest                                |
| Tests (e2e)              | Playwright                            |
| Workspace orchestration  | pnpm + Turborepo                      |

Switching any layer requires a new ADR.

---

## 3. Commands

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
| Tests (watch)                  | `pnpm test:watch`         |
| Integration tests (DB)         | `pnpm test:integration`   |
| e2e (Playwright)               | `pnpm e2e`                |
| Install Playwright browsers    | `pnpm e2e:install`        |
| Build (all)                    | `pnpm build`              |
| Dev (all apps)                 | `pnpm dev`                |
| Full CI gate (run before push) | `pnpm verify`             |

The CI gate (`pnpm verify`) runs lint → typecheck → test (unit only). **A change is not done until `pnpm verify` is green.**

`pnpm test:integration` runs `*.integration.test.*` files against the local Supabase Postgres (`localhost:54322`). **Requires `pnpx supabase start` and `pnpm --filter @ai-workspace-lab/db db:migrate` first.** e2e tests run in their own CI job; trigger locally with `pnpm e2e`.

CI runs integration tests in a separate `test-integration` job using `supabase/setup-cli` to spin up Supabase automatically.

---

## 4. Coding standards

1. **Strict TypeScript, no `any`.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature` are all on. Array reads may be `undefined` — handle it.
2. **Shared types belong in `@ai-workspace-lab/types`.** Do not duplicate type definitions across packages or use ad-hoc inline unions where a named type would do.
3. **No silent failures.** Every error path either returns a typed error or throws. No `catch {}`. No `// @ts-ignore`.
4. **Server owns trust.** Auth, authorization, entitlements, and quotas are checked **server-side**, never in the client.
5. **Async by default for expensive work.** Anything that could block a user request for >1s belongs on a queue.
6. **Every expensive action is measured.** Usage events feed quotas, billing, and observability — they are not optional.
7. **Managed services first, primitives understood.** Use Supabase / Stripe / Sentry — but write the ADR that explains the underlying contract.
8. **Imports.** Use the `node:` prefix for Node built-ins. Use `import type` for type-only imports. No unused imports or variables (Biome enforces).
9. **Comments.** Default to none. Only add a comment when the *why* is non-obvious. Don't restate the code.
10. **No new abstractions on speculation.** Three repeated lines is fine. Wait for the fourth.

---

## 5. Testing requirements

- **Unit tests:** Vitest, colocated as `*.test.ts` next to the source.
- **e2e:** Playwright, in `apps/e2e/`. Chromium-only by default.
- **Required tests:**
  - Anything that crosses a trust boundary (auth, entitlement, quota, webhook) **must** have a test.
  - Anything that touches money (Stripe webhook handlers, plan/quota math) **must** have a test that demonstrates idempotency.
  - Migration files must be exercised by at least one test against a real Postgres (no mocks).
- **No mocking the database for integration tests.** Tests that hit Postgres should hit a real Postgres (Supabase local or testcontainers).
- **A green `pnpm verify` is the minimum bar before push.** No exceptions, no `--no-verify` skipping hooks.

---

## 6. Migration rules

Migrations live in `packages/db/migrations/`.

1. **Forward-only.** Once a migration is merged to `main`, it is irreversible in production. Write a *new* migration to undo, never edit the old one.
2. **One migration per logical change.** Don't bundle table changes that can be reasoned about separately.
3. **Backfills are migrations too.** A `NOT NULL` column on an existing table requires a backfill migration before the constraint is enforced.
4. **Every migration gets a test.** The test runs the migration against a real Postgres and asserts the post-state.
5. **No table is added without an ERD entry.** If the table is not in [`docs/product/erd.md`](./docs/product/erd.md) or a new ADR explaining why, do not create it.
6. **RLS policies ship with the table.** Every organization-scoped table must enable RLS in the same migration that creates it.

---

## 7. Route creation rules

The frontend route map is [`docs/product/frontend-page-map.md`](./docs/product/frontend-page-map.md). It defines every public, auth, app, admin, account, dev, and Electron screen, with priority, target sprint, backend deps, analytics, and authorization.

**Before creating, renaming, or deleting any frontend route, read `docs/product/frontend-page-map.md` and keep it updated.**

When adding a frontend page:

1. Check `docs/product/frontend-page-map.md`.
2. Confirm the route belongs to the current sprint (don't ship P2 work during a P0 sprint).
3. Add route-level authorization first.
4. Add loading, empty, and error states.
5. Add the analytics events listed in the page map.
6. Add server-side organization checks for every org-scoped route.
7. Do not fetch organization-scoped data without filtering by `organization_id`.
8. **Do not create new routes that do not exist in `docs/product/frontend-page-map.md`.** If a new route is needed, update the page map in the same PR.

---

## 8. Authorization rules

Authorization is **always server-side**. Client-side checks are UX only and may not be the only gate.

| Route group               | Required check                                   |
| ------------------------- | ------------------------------------------------ |
| `/` public pages          | None                                             |
| `/sign-in`, `/sign-up`    | Redirect signed-in users away                    |
| `/onboarding/*`           | `requireUser()`                                  |
| `/app`                    | `requireUser()`                                  |
| `/app/[orgSlug]/*`        | `requireUser()` + `requireMembership()`          |
| `/app/[orgSlug]/billing`  | View: member; manage: owner                      |
| `/app/[orgSlug]/members`  | View: member; invite: admin/owner                |
| `/app/[orgSlug]/settings` | View: member; edit: owner/admin depending action |
| `/admin/*`                | `requirePlatformAdmin()`                         |
| `/dev/*`                  | Development only — 404 in production             |
| `/account/*`              | `requireUser()`                                  |

Rules:

1. **Every protected route must perform server-side auth checks** (Server Component / Route Handler / Server Action).
2. **Platform admin is not the same as organization owner.** `requirePlatformAdmin()` is a separate check.
3. **Invite tokens validate server-side.** The token is the gate — never trust a client claim of "I'm allowed in this org."
4. **Webhook handlers verify provider signatures** before any side effect. No signature, no work.

---

## 9. Organization-scoped data rules

Every row that belongs to an organization carries `organization_id`. Every read and every write filters by it.

1. **Every organization-scoped query must filter by `organization_id`.** If the query plan does not include the `organization_id` predicate, it is a bug.
2. **RLS is the second gate, not the first.** App code filters by `organization_id`. RLS is the safety net for when the app code is wrong.
3. **No cross-organization writes, ever.** Inserting/updating a row with one org's `organization_id` based on a request authenticated for another org is a critical bug.
4. **AI retrieval must verify chunk org-membership.** When pulling RAG chunks for a prompt, every retrieved `document_chunks` row must be re-checked to belong to the current organization before being passed to the model.
5. **Cross-org joins** (e.g., a collection containing documents) **must assert the same `organization_id`** before write.
6. **Analytics and logs** include `organization_id` so we can scope incident response.

---

## 10. Environment variable rules

The contract is [`.env.example`](./.env.example). It is the source of truth for what every layer of the stack needs.

1. **Never commit a real secret.** Only `.env.example` is tracked. `.env*` (anything else) is gitignored.
2. **Add new vars to `.env.example` first**, with a comment explaining where the value comes from. PRs that introduce a var without updating `.env.example` are not done.
3. **Server-only secrets** (Stripe secret key, Supabase service role, Anthropic API key) **never appear in client bundles.** Use `NEXT_PUBLIC_` only for keys that are safe in a browser bundle.
4. **Validate at boot.** The server should fail fast with a readable error if a required env var is missing — not silently degrade.
5. **No env reads outside the boundary.** Read env in a single boot/config module per app/package, not scattered across feature code.
6. **Rotation.** If a real secret leaks (committed, pasted in chat, exposed in logs), rotate it immediately and document the incident.

---

## 11. Branch naming and Git hygiene

```txt
<type>/<short-kebab-description>
```

- `feature/` — new functionality
- `fix/` — bug fix
- `chore/` — build, deps, tooling, refactors with no behavior change
- `docs/` — docs-only
- `adr/` — adding or revising an ADR

Examples: `feature/auth-supabase`, `fix/quota-off-by-one`, `chore/turbo-cache`, `adr/0004-billing`.

**Never commit to `main`.** Always work on a branch and open a PR.

---

## 12. Commit / PR checklist

Every commit:

- [ ] One logical change (split unrelated changes into separate commits)
- [ ] Subject line uses conventional prefix: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`
- [ ] References the ADR or PRD section if architecturally relevant
- [ ] Hooks were not skipped (`--no-verify` is forbidden unless the user explicitly asked)

Every PR:

- [ ] `pnpm verify` is green locally before push
- [ ] New routes are listed in `docs/product/frontend-page-map.md`
- [ ] New tables are listed in `docs/product/erd.md` (or covered by a new ADR)
- [ ] New env vars are added to `.env.example`
- [ ] Server-side auth/authz checks exist for every protected route added
- [ ] Org-scoped queries filter by `organization_id`
- [ ] AI provider calls are gated by entitlement + quota + rate limit
- [ ] Tests added for trust boundaries (auth, entitlement, quota, webhook, billing, migration)
- [ ] No real secrets in the diff
- [ ] PR description summarizes *what* and *why*, links the relevant doc/ADR, and includes a test plan

Do not push to `main`. Do not push remote without explicit user approval.

---

## 13. Critical rules — do not violate

These rules exist because violating them creates real money, data, or trust incidents.

1. **Do not create new frontend routes unless they exist in `docs/product/frontend-page-map.md`.** Update the map first.
2. **Do not create new database tables unless they exist in `docs/product/prd.md` (or its ERD), or a new ADR explains why.**
3. **Every organization-scoped query must filter by `organization_id`.**
4. **Every protected route must perform server-side auth checks.** Client-side checks are UX, not security.
5. **Every expensive AI action must check entitlement, quota, and rate limit before provider calls.**
6. **Stripe webhook handlers must verify the signature and be idempotent.** Duplicate side effects are real money.
7. **Server-only secrets never reach the client bundle.**
8. **Migration files are forward-only once merged.** Never edit a shipped migration; write a new one.

---

## 14. Do-not-change-without-test boundaries

These modules carry production-shaped invariants. **Do not modify them without first adding or updating a test that demonstrates the change is correct.** If a test does not yet exist, write one before the change.

| Boundary                                             | Reason                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/types/src/**`                              | Shared types are a cross-package contract. Breakage cascades.       |
| Anything named `*entitlement*`, `*quota*`, `*authz*` | Server-side trust. A wrong unlock is a paying-customer incident.    |
| Anything named `*webhook*` (especially Stripe)       | Idempotency invariants. Duplicate effects are real money.           |
| Anything named `*job*`, `*queue*`, `*retry*`         | Failure-mode behavior. Wrong retry = duplicate cost or silent loss. |
| Migration files (`packages/db/**/migrations/**`)     | Once shipped, irreversible. Write the test against the migration.   |
| `biome.json`, `tsconfig.base.json`                   | Affects every package. A loosening must be justified in PR.         |

---

## 15. ADR location and format

Architecture Decision Records live in [`docs/adr/`](./docs/adr/), numbered sequentially: `0001-…md`, `0002-…md`, etc.

```txt
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

---

## 16. What lives where

```txt
ai-workspace-lab/
├── apps/                         # one folder per product surface (web, desktop, e2e)
├── packages/
│   ├── config/                   # shared tsconfig presets
│   ├── types/                    # shared TS types (no runtime code)
│   ├── ui/                       # shared UI primitives
│   ├── db/                       # Postgres client + migrations
│   ├── auth/                     # auth + sessions
│   ├── billing/                  # Stripe billing + webhooks
│   ├── entitlements/             # plan tiers, quotas, server-side trust
│   ├── ai/                       # Vercel AI SDK + Anthropic helpers
│   ├── jobs/                     # background queue + retries
│   ├── email/                    # Resend transactional email
│   └── analytics/                # PostHog event taxonomy + flags
├── docs/
│   ├── product/                  # PRD, ERD, frontend page map
│   ├── adr/                      # architecture decision records
│   ├── runbooks/                 # incident response, ops procedures
│   ├── performance/              # budgets, capacity, cost ceilings
│   ├── studies/                  # time-boxed investigations
│   └── journal/                  # how we built the foundation
├── learning-journal.md           # weekly reflection — keep this updated
├── CLAUDE.md                     # this file
├── README.md                     # human-facing quickstart
└── .env.example                  # env contract for the locked stack
```

---

## 17. GitHub / git rules

- **Before any `gh pr create`, unset both `GH_TOKEN` and `GITHUB_TOKEN`** to authenticate as the repo owner (`hongleir2`). Both env vars are set to work-account tokens that lack collaborator access or `public_repo` scope on personal repos. Use: `env -u GH_TOKEN -u GITHUB_TOKEN gh pr create ...`
- Always open PRs from feature/fix branches — never push directly to `main`.
- **This repo has no `dev` branch. All PRs target `main`.** The global CLAUDE.md rule "base PRs against `dev`" applies to Otter.ai repos only — do not apply it here.

---

## 18. When in doubt

- **Stop, do not improvise on stack or boundaries.** Open an ADR or ask.
- **Re-read this file at the start of any non-trivial change.**
- **A green `pnpm verify` is not optional.**
- **No new routes without updating `docs/product/frontend-page-map.md`. No new tables without ERD/ADR. No org-scoped query without `organization_id`.**
