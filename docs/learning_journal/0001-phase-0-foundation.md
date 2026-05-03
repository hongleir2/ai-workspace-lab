# 0001 — Phase 0 foundation walkthrough

> **⚠ Partially superseded by [0002](./0002-tooling-switch-to-biome-and-playwright.md)** —
> the lint/format sections below describe the original ESLint + Prettier setup. We switched
> to Biome shortly after Phase 0 wrapped; see 0002 for rationale and the new tool layout.
> The rest of this document (TypeScript, Turborepo, Vitest, ADRs, etc.) is still current.

> Companion to [ADR 0001](../adr/0001-stack-choice.md). This is a learning artifact:
> what every file in the bootstrap does, why each tool exists, and what we'd lose
> by picking the alternative.

The lab is built on the principle in the roadmap: **AI agents amplify clear engineering systems.** Phase 0 is the amplifier. None of the files below ship product features — they exist so that every later commit lands in a typecheck/lint/test gate that prevents drift.

---

## Part 1 — Every file in the repo, explained

### Root: workspace orchestration

| File                  | Purpose                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` (root) | The "control panel." Declares the repo as a private workspace, pins `pnpm@10.4.1` via `packageManager`, lists root-only dev deps (turbo, vitest, eslint, prettier, typescript), and exposes top-level scripts (`lint`, `typecheck`, `test`, `verify`). Apps and packages have their own `package.json`. |
| `pnpm-workspace.yaml` | Tells pnpm which directories contain packages. Every folder under `apps/*` and `packages/*` is treated as a workspace; cross-package deps use `"workspace:*"` and resolve to the local copy.                                                                                                            |
| `.npmrc`              | pnpm settings: `auto-install-peers=true` so we don't see endless peer warnings, `shamefully-hoist=false` to keep strict module resolution (this is the whole reason to choose pnpm — no surprise transitive deps).                                                                                      |
| `turbo.json`          | Turborepo task graph. Declares `build`, `dev`, `lint`, `typecheck`, `test`, `clean`. `dependsOn: ["^build"]` means a package's task runs only after its dependencies' builds succeed; `outputs` tells Turbo what to cache. The `ui: "tui"` flag opts into the new task-runner UI.                       |
| `.nvmrc`              | Pins Node 22.17.1 so `nvm use` and `actions/setup-node` agree. CI reads this file directly.                                                                                                                                                                                                             |
| `.editorconfig`       | Cross-editor whitespace rules (LF, 2-space indent, trim trailing whitespace, final newline). Tooling-agnostic so VSCode, JetBrains, Vim all behave the same.                                                                                                                                            |
| `.gitignore`          | Standard Node ignores plus monorepo additions: `.turbo`, `*.tsbuildinfo`, `.next`, `.env*` (allowlists `.env.example`).                                                                                                                                                                                 |

### Root: TypeScript

| File                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json` (root)               | The repo-level TS project. `extends` the canonical base in `@ai-workspace-lab/config`, sets `noEmit: true`, includes `vitest.config.ts` and `eslint.config.mjs` so they're typechecked too. Per-package tsconfigs override what they need.                                                                                                                                                                       |
| `packages/config/tsconfig.base.json` | The canonical strict config. Highlights: `strict`, `noUncheckedIndexedAccess` (array index returns `T \| undefined`), `exactOptionalPropertyTypes` (`{ x?: T }` ≠ `{ x: T \| undefined }`), `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `useUnknownInCatchVariables`, `isolatedModules`, ES2022 target with Bundler module resolution. Every other package's tsconfig extends this one. |

### Root: Lint and format

| File                                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eslint.config.mjs` (root)            | One-line wrapper that re-exports `@ai-workspace-lab/config/eslint`. ESLint 9 flat config — no more `.eslintrc.json` cascade, just a default-exported array of config objects.                                                                                                                                                                                                                                 |
| `packages/config/eslint.config.mjs`   | The canonical lint preset. Type-aware rules (`recommendedTypeChecked` + `stylisticTypeChecked`) are scoped to `**/*.ts(x)` so they don't try to parse the `.mjs` config files (a common ESLint 9 pitfall). Tests get loosened rules. Prettier compat ships last to disable stylistic conflicts. Custom rules: `consistent-type-imports`, no `any`, no non-null assertion, `eqeqeq`, `no-console` warn. |
| `.prettierrc` (root)                  | Prettier config. Single quotes, trailing commas everywhere, 100-char width, LF line endings. The canonical version lives at `packages/config/prettier.config.mjs`; the root copy is what Prettier picks up by default during `pnpm format`.                                                                                                                                                            |
| `.prettierignore`                     | Stops Prettier from rewriting `pnpm-lock.yaml`, build outputs, and tsbuildinfo.                                                                                                                                                                                                                                                                                                                        |
| `packages/config/prettier.config.mjs` | Reusable preset apps can import via `export { default } from '@ai-workspace-lab/config/prettier'`.                                                                                                                                                                                                                                                                                                            |

### Root: Test

| File               | Purpose                                                                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest.config.ts` | Vitest workspace config. Picks up `**/src/**/*.{test,spec}.ts` from any app or package. Coverage uses v8 (built into Node, no native deps), reports as text + lcov. One config to rule them all — packages can override later if needed. |

### Root: CI

| File                       | Purpose                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/ci.yml` | Runs on every PR and every push to `main`. Steps: checkout → install pnpm → install Node from `.nvmrc` → `pnpm install --frozen-lockfile` → format check → lint → typecheck → test. `concurrency` cancels in-progress runs when a new commit lands on the same ref. `TURBO_TELEMETRY_DISABLED=1` is environment hygiene. |

### Packages

| File                               | Purpose                                                                                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/config/package.json`     | Defines `@ai-workspace-lab/config` and exports the three presets via the `exports` map. `peerDependencies` declare the host versions of eslint/prettier/typescript so consumers control them.  |
| `packages/config/README.md`        | How to consume the presets from another package — short copy-paste examples.                                                                                                            |
| `packages/types/package.json`      | `@ai-workspace-lab/types`, type-only package. `main` and `types` point at `src/index.ts` directly so consumers compile against source (no build step).                                         |
| `packages/types/tsconfig.json`     | Extends the base, adds `rootDir`/`outDir` for future emit if needed.                                                                                                                    |
| `packages/types/eslint.config.mjs` | Re-exports the shared preset.                                                                                                                                                           |
| `packages/types/src/index.ts`      | Currently exports `Brand<T, B>`, `UserId`, `OrganizationId`. The convention comment tells future-self to organize by domain (`auth.ts`, `billing.ts`, …) and keep this file pure types. |
| `packages/types/src/index.test.ts` | Smoke test — proves the test runner picks up tests from this package. Replace with real type-runtime invariants as we add them.                                                         |
| `packages/ui/package.json`         | `@ai-workspace-lab/ui`, JSX-enabled (`jsx: "react-jsx"`, lib includes DOM). Empty stub today; primitives land here in Phase 2.                                                                 |
| `packages/ui/tsconfig.json`        | Same as types but with DOM lib + JSX.                                                                                                                                                   |
| `packages/ui/src/index.ts`         | Empty marker file (`export {}` makes it a module).                                                                                                                                      |

### Docs and operating contracts

| File                                               | Purpose                                                                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                        | The contract for AI agents working in this repo. Commands, branch naming, ADR location, "do-not-change-without-test" boundaries (entitlement / quota / authz / webhook / job code), engineering rules. Loaded automatically by Claude Code. |
| `README.md`                                        | Human-facing quickstart: stack summary, layout, commands, conventions, how to add a new app or package.                                                                                                                                     |
| `learning-journal.md`                              | Weekly reflection log committed to. Phase 0 entry already in.                                                                                                                                                                               |
| `docs/adr/0001-stack-choice.md`                    | The ADR that locks the default stack. Superseded only by a new ADR.                                                                                                                                                                         |
| `docs/learning_journal/0001-phase-0-foundation.md` | This file.                                                                                                                                                                                                                                  |

### Lockfile and caches (gitignored or generated)

| File             | Purpose                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm-lock.yaml` | Committed. The only source of truth for resolved transitive versions; CI uses `--frozen-lockfile` so it can never drift silently.                                                      |
| `.turbo/`        | Local Turbo cache. Hashes inputs (source files, package.json, etc.) and replays cached output when nothing changed. Hugely speeds up `pnpm typecheck` after the first run. Gitignored. |
| `node_modules/`  | pnpm's content-addressed store. Symlinked from each workspace, never duplicated on disk. Gitignored.                                                                                   |

---

## Part 2 — Tech stack: pros, cons, alternatives

For each layer: **what we picked**, **why**, **what we accepted by picking it**, **what else exists and how it compares**, **the trigger that would make us switch**.

---

### 2.1 Monorepo orchestration → **pnpm workspaces + Turborepo**

**Pros**

- pnpm uses a content-addressed store and symlinks; dependencies are not duplicated on disk and cannot be accidentally accessed if not declared (no phantom deps).
- Turborepo gives a remote-cacheable task graph: `pnpm typecheck` after a no-op edit is ~100ms.
- Both tools are minimal and incremental — adoptable in a single afternoon, removable in another.
- pnpm's workspace protocol (`workspace:*`) keeps cross-package versioning honest until publish.

**Cons**

- Two tools to learn (npm/yarn each ship workspaces themselves).
- `shamefully-hoist=false` (the safe default) occasionally breaks packages that secretly depend on hoisted modules — you have to either pin or patch.
- Turbo's caching can mask config bugs ("works locally because cached"). Mitigation: always run `pnpm verify` clean once before merging.

**Alternatives**

| Option                            | Pros                                                          | Cons                                                                              |
| --------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **npm workspaces**                | Built into Node, zero install.                                | Hoists everything, slow installs at scale, no task graph caching.                 |
| **Yarn workspaces (Berry / PnP)** | Plug'n'Play removes node_modules entirely; great deduping.    | PnP breaks tools that don't support it; classic Yarn (1.x) is unmaintained.       |
| **Bun workspaces**                | Very fast install, built-in test runner.                      | Ecosystem still maturing; some Next.js/Vercel edges; lockfile format is bun-only. |
| **Nx**                            | Powerful task graph, generators, plugins for every framework. | Big surface area, opinionated; overkill for a 1–3 app indie repo.                 |
| **Lerna + npm**                   | Once-standard.                                                | Largely superseded by Turbo/Nx; legacy.                                           |
| **Rush (Microsoft)**              | Built for very large monorepos.                               | Heavy ceremony, designed for orgs with build engineers.                           |

**Switch trigger**: If pnpm install times become a real bottleneck or we need PnP-level dedup, evaluate Bun. If we ever cross ~10 apps/packages, evaluate Nx for its generators.

---

### 2.2 Language → **TypeScript (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`)**

**Pros**

- Catches a huge class of bugs at the type boundary; the strict flags listed above eliminate the most common runtime traps in serverless code (nulls from index access, optional-vs-undefined confusion).
- `verbatimModuleSyntax` + ESM + Bundler resolution match Next.js 15 / Vercel runtime exactly.
- Editor tooling is unmatched: jump-to-def, refactor-rename, inline errors all "just work."

**Cons**

- Compile step adds ~1–3s to local feedback (tsc) — Turbo cache mitigates, but raw `tsc --noEmit` is the slowest part of `verify`.
- Strict mode forces error handling that JS lets you skip; this is _good_ but slower to write.
- TypeScript's structural typing occasionally surprises when you assume nominal types — that's why we use branded types (`Brand<T, B>`) in `packages/types`.

**Alternatives**

| Option                  | Pros                                      | Cons                                                                                                         |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Plain JavaScript**    | No build, no types config.                | No safety; refactors become archaeology; AI agents drift much faster without types.                          |
| **JSDoc + checkJs**     | Types without a transpiler step.          | Verbose for anything beyond simple shapes; tooling support patchy; doesn't scale to multi-package contracts. |
| **Flow (Meta)**         | Used to compete with TS.                  | Effectively dead outside Meta.                                                                               |
| **ReScript / ReasonML** | Sound type system, OCaml-grade inference. | Tiny ecosystem; FFI to JS libraries is friction; hiring/AI familiarity is poor.                              |
| **PureScript / Elm**    | Even stronger guarantees.                 | Ecosystem mismatch with Next.js + Node; not pragmatic for indie product velocity.                            |

**Switch trigger**: None plausible. We may _loosen_ a flag for a specific package (e.g. `exactOptionalPropertyTypes: false` if a third-party type breaks), but TS itself is a forever choice.

---

### 2.3 Lint → **ESLint 9 (flat config) + typescript-eslint**

**Pros**

- Industry standard; every TS rule we'd want exists.
- Flat config (`eslint.config.mjs`) is finally simple — one default export, no `.eslintrc` cascade.
- typescript-eslint's `recommendedTypeChecked` + `stylisticTypeChecked` catch real bugs (`no-floating-promises`, `await-thenable`, `no-misused-promises`).

**Cons**

- Type-aware lint requires reading tsconfig per file → slower than non-type-aware.
- Flat config + `projectService` has sharp edges (we already hit one: config files needed to be excluded from type-aware rules).
- Plugin ecosystem fragmentation between flat and legacy configs is still ongoing.

**Alternatives**

| Option                         | Pros                                                                   | Cons                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Biome**                      | Single Rust binary; lints + formats; ~20× faster than eslint+prettier. | Smaller rule set; no type-aware rules; some TS-specific bugs ESLint catches, Biome misses. (User explicitly chose ESLint+Prettier for this lab.) |
| **deno lint**                  | Fast, batteries included.                                              | Tied to the Deno ecosystem; gaps for Next.js.                                                                                                    |
| **Oxlint**                     | Even faster than Biome.                                                | Subset of ESLint rules; type-aware rules are early.                                                                                              |
| **No linter, rely on TS only** | Zero config.                                                           | Loses idiomatic-code rules and bug-hunters that the type system can't see.                                                                       |

**Switch trigger**: If `pnpm lint` exceeds ~30s on the full repo, revisit Biome (we'd accept losing some type-aware rules for the speed). If Oxlint reaches feature parity with typescript-eslint we may revisit then.

---

### 2.4 Formatter → **Prettier 3**

**Pros**

- Settled debate. Every editor integrates. Auto-fix is reliable.
- `prettier --check` makes "did you forget to format?" a CI failure, not a review comment.
- Plays well with ESLint via `eslint-config-prettier`.

**Cons**

- Slow on large repos vs Rust-native formatters.
- Configuration is intentionally minimal — sometimes you can't get the exact wrap behavior you want.

**Alternatives**

| Option           | Pros                             | Cons                                                                         |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| **Biome format** | Rust speed; bundled with linter. | Slightly different opinions; still maturing on edge cases (JSX, decorators). |
| **dprint**       | Pluggable, fast.                 | Smaller ecosystem; less editor integration.                                  |
| **No formatter** | One less tool.                   | Endless review nits. Not viable.                                             |

**Switch trigger**: If we adopt Biome for lint we'd take its formatter too.

---

### 2.5 Test runner → **Vitest 2**

**Pros**

- Vite-native; instant ESM and TSX support without `ts-jest` ceremony.
- Watch mode is genuinely fast (sub-second).
- Jest-compatible API — anything we already know about `expect`, mocks, fixtures applies.
- First-class workspace support — one config picks up tests across all packages.

**Cons**

- Some Jest plugins (especially older ones) don't work; we may need to find alternatives.
- Coverage via v8 has corner cases on async code that Istanbul handles better; switchable.
- Still on a deprecation warning when run via the CJS Node API (cosmetic, not breaking).

**Alternatives**

| Option                          | Pros                                     | Cons                                                                            |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| **Jest**                        | Mature, huge ecosystem, well-documented. | Slower than Vitest; ESM support has been a long, painful saga.                  |
| **Node's built-in `node:test`** | Zero deps; ships with Node.              | API is bare; no mocks framework, no snapshot testing built in.                  |
| **Bun test**                    | Very fast.                               | Bun-only; partial Jest API; unrealistic if we're not running Bun in production. |
| **uvu / tape**                  | Tiny, fast.                              | Minimal — you'd have to glue in mocks, coverage, etc. yourself.                 |
| **Mocha + Chai**                | Classic.                                 | Lots of glue code; ESM friction.                                                |

**Switch trigger**: None expected. We'd consider `node:test` for one-off scripts that don't justify Vitest's startup cost.

---

### 2.6 CI → **GitHub Actions**

**Pros**

- Native to GitHub; PR/push triggers are one-line.
- Free for public repos and generous for private.
- Huge marketplace of actions; pnpm/Node setup is one line each.

**Cons**

- Vendor-locked to GitHub.
- macOS/Windows runners are pricier than Linux (Linux is free for most plans).
- Workflow YAML can drift into spaghetti; we keep ours small.

**Alternatives**

| Option                         | Pros                                           | Cons                                                          |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------- |
| **CircleCI**                   | Faster startup historically; powerful caching. | External vendor; another bill.                                |
| **GitLab CI**                  | Tightly integrated if using GitLab.            | We use GitHub.                                                |
| **Buildkite**                  | Self-hosted runners with cloud orchestration.  | Setup overhead; pricing model heavier.                        |
| **Vercel build pipeline only** | Already configured for the Next.js app.        | Doesn't run unit tests / lint on PR; not a substitute for CI. |
| **No CI**                      | Saves $0.                                      | Defeats the entire point of Phase 0.                          |

**Switch trigger**: Cost or speed pressure. None expected at indie scale.

---

### 2.7 Web framework → **Next.js 15 + App Router + RSC**

**Pros**

- Server Components + Server Actions collapse the typical "Express API + React client" boilerplate into one typed boundary.
- Streaming SSR + Suspense is built in — critical for AI streaming UX.
- Vercel deploy is one command; preview URLs per PR are free observability gold.
- Massive community → AI agents have seen this code shape in their training data.

**Cons**

- Vercel-shaped runtime constraints (request body, edge cap, function size).
- App Router is still maturing — patterns shift between minor versions.
- "Magic" boundaries (server vs client components) require discipline; easy to leak server code to the client without strict eslint rules.
- Cold starts on serverless, mitigated by edge / RSC streaming but not eliminated.

**Alternatives**

| Option                             | Pros                                                     | Cons                                                                               |
| ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Remix / React Router 7**         | Web-standard `Request`/`Response`, simpler mental model. | Smaller ecosystem; less Vercel-ish DX; AI streaming UX patterns less standardized. |
| **SvelteKit**                      | Smaller bundles, simpler reactivity.                     | Smaller ecosystem; we'd lose React component reuse.                                |
| **Astro**                          | Best-in-class for content sites.                         | Not designed for highly interactive SaaS dashboards.                               |
| **Vite + React Router (SPA)**      | Fast local dev, no SSR complexity.                       | We give up SSR/SEO, server actions, streaming.                                     |
| **TanStack Start**                 | Excellent type-safe routing.                             | New; ecosystem still small.                                                        |
| **Hono / Express + React (split)** | Fully decoupled API.                                     | Doubles deploy surface; we lose RSC.                                               |
| **Nuxt (Vue)**                     | Vue ergonomic.                                           | Different ecosystem; lose React.                                                   |

**Switch trigger**: A real serverless limit (large file uploads, sustained streaming, large in-memory state) forces a separate API service. Per ADR 0001 we add a backing service rather than swapping the framework.

---

### 2.8 Database → **Supabase Postgres**

**Pros**

- Real Postgres — no ORM-layer surprises, no proprietary query language.
- Bundles auth, storage, realtime, edge functions in one console — _one_ connection model to learn.
- pgvector ships natively; we don't need a vector DB on day one.
- Migrations are SQL files in the repo; version-controlled, no UI-only schema drift.

**Cons**

- Vendor concentration: auth + DB + storage + realtime all in one provider. If they ever degrade, multiple subsystems hurt at once.
- Connection pool ceiling on the cheaper plans; serverless callers must use pgbouncer / Supavisor.
- RLS performance can surprise — every policy is a `WHERE` clause appended to every query.
- Region selection at project creation is sticky (no easy region migration).

**Alternatives**

| Option                                 | Pros                                                                               | Cons                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Neon**                               | Branching (per-PR DB), serverless cold-start optimized, separated storage/compute. | No bundled auth/storage; we'd build/buy those separately.                                 |
| **PlanetScale**                        | Vitess-backed MySQL, branching, no-FK migrations.                                  | MySQL (no Postgres extensions like pgvector); FK enforcement off by default historically. |
| **Render Postgres / Railway Postgres** | Cheap managed Postgres.                                                            | No bundled auth/storage; less polished tooling.                                           |
| **CockroachDB Serverless**             | Distributed-by-default, strong consistency.                                        | Postgres-compatible but not 100%; some pgvector / extension gaps.                         |
| **AWS RDS / Aurora Postgres**          | Production-grade, infinite knobs.                                                  | Console is hostile to indie velocity; we'd spend a week on networking.                    |
| **Self-hosted Postgres**               | Full control.                                                                      | We are not running our own DB.                                                            |
| **DynamoDB / Mongo**                   | Different shape — sometimes simpler for single-app.                                | Loses relational power; multi-tenant org-scoped queries become harder.                    |

**Switch trigger**: Heavy schema-iteration workflow → Neon (for branches). Cross-region replication needs → AWS Aurora. Per-tenant DB isolation requirement (compliance) → Neon branches per tenant.

---

### 2.9 Auth → **Supabase Auth (now) → maybe Clerk (Phase 4)**

**Pros (Supabase Auth)**

- Already in the same console as the database; no extra vendor.
- Email/password, OAuth, magic link, MFA — all in scope.
- Cookie-based session works cleanly with Next.js Server Actions via `@supabase/ssr`.
- RLS in Postgres can read `auth.uid()` directly — least-privilege at the DB layer.

**Cons (Supabase Auth)**

- Org / team / RBAC UI is **not** included — we build invitations, member management, role switching ourselves. This is the entire Phase-4 trigger.
- JWT claim management is manual; updating roles requires care to avoid stale tokens.
- Email deliverability depends on Supabase's SMTP unless we plug in our own (Resend integration possible).

**Alternatives**

| Option                        | Pros                                                                                                              | Cons                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Clerk**                     | Pre-built org / team / RBAC / invite UIs; saves _weeks_ on the team-management Phase. Excellent React components. | Another vendor + bill; pricing scales with MAU; JWT round-trip via webhooks for DB sync.          |
| **Auth0**                     | Enterprise-grade; SSO; mature SDKs.                                                                               | Pricing ramps fast; UI is heavier than indie scale needs.                                         |
| **NextAuth / Auth.js**        | Self-hosted; full control.                                                                                        | We own the bug surface; sessions, CSRF, MFA all on us; org/RBAC still DIY.                        |
| **Lucia Auth**                | Lightweight, library-not-service.                                                                                 | Maintenance overhead; recently announced sunset for v3 — risky to adopt.                          |
| **WorkOS**                    | SSO/SAML + directory sync built in.                                                                               | Overkill until we have enterprise customers.                                                      |
| **Custom (cookies + Argon2)** | We learn everything.                                                                                              | We become the on-call for password reset, session fixation, MFA; net negative for indie velocity. |

**Switch trigger**: We're spending more time hand-rolling org/team/RBAC UI than learning from it (ADR 0001's Phase-4 honesty test).

---

### 2.10 Payments → **Stripe Billing**

**Pros**

- Industry default; AI agents and humans both know its API by heart.
- Test mode, webhooks, customer portal, dunning, tax (Stripe Tax), invoicing — already built.
- Documentation is the gold standard.
- Webhooks make idempotency tractable if we use the event ID as a key (we will, in Phase 2).

**Cons**

- Webhook reliability is a real failure mode: events can duplicate, arrive out of order, or be missed entirely if our endpoint is down. We need an idempotency table from day one.
- Pricing (2.9% + $0.30 base) — fine at indie scale, painful at enterprise volume.
- Vendor lock-in for the actual subscription state — if we ever migrate, customer payment-method tokens have to be migrated by Stripe (with their cooperation).

**Alternatives**

| Option                  | Pros                                                 | Cons                                                                            |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Paddle**              | Merchant of record — handles VAT/sales tax globally. | Higher fees; less flexible API; less developer mindshare.                       |
| **Lemon Squeezy**       | Merchant of record; great DX for indie SaaS.         | Smaller scale; recently acquired by Stripe (alignment risk).                    |
| **Polar.sh**            | Open-source, GitHub-integrated billing.              | Newer; smaller ecosystem.                                                       |
| **Recurly / Chargebee** | Enterprise subscription management on top of Stripe. | Adds another vendor + bill; not indie-shaped.                                   |
| **Custom billing**      | Full control.                                        | Insane scope creep — taxes, dunning, refunds, chargebacks, currency. **Never.** |

**Switch trigger**: ADR 0001 says "Never." If we ever sell to a market where merchant-of-record matters more than DX (heavy VAT exposure), reconsider Paddle.

---

### 2.11 Email → **Resend**

**Pros**

- API is `fetch({ to, from, subject, html })` — it does not get simpler.
- React Email integration → templates as JSX components, not HTML soup.
- Cheap, generous free tier.

**Cons**

- Newer than competitors; smaller deliverability track record (improving fast).
- No built-in marketing-automation features (we don't need them yet).

**Alternatives**

| Option                  | Pros                                        | Cons                                                     |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **Postmark**            | Best-in-class transactional deliverability. | Pricier per email; less "developer indie" flavor.        |
| **SendGrid**            | Massive scale; deep features.               | Heavy console; spam-folder reputation has been mixed.    |
| **AWS SES**             | Cheapest at scale.                          | DIY templates, bounce handling, deliverability tuning.   |
| **Mailgun**             | Mature API.                                 | Similar to SendGrid; pricier than Resend at indie scale. |
| **Loops / Customer.io** | Marketing + transactional combined.         | Overkill for transactional only.                         |

**Switch trigger**: A deliverability issue that Resend can't resolve → Postmark. Cost at very high volume → SES.

---

### 2.12 Errors / tracing → **Sentry**

**Pros**

- Errors, traces, profiling, and session replay in one product.
- Source maps for both server and browser → real stack traces in production.
- Alert routing is flexible (Slack, PagerDuty, email).
- Free tier covers indie scale comfortably.

**Cons**

- The Next.js SDK can affect bundle size; needs careful boundary configuration.
- Pricing scales with event volume — a noisy bug can spike the bill.
- Replay sessions can capture sensitive content if we don't set `maskAllText: true` and friends.

**Alternatives**

| Option                          | Pros                                          | Cons                                                                |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| **Datadog**                     | One vendor for metrics + APM + logs + errors. | Pricing is enterprise-grade; not indie.                             |
| **Honeycomb**                   | Best-in-class wide-event observability.       | Errors are not the primary use case; we'd pair with something else. |
| **Highlight.io**                | Open source; session replay focused.          | Self-host overhead.                                                 |
| **LogRocket**                   | Strong session replay.                        | More UX-debugging than backend tracing.                             |
| **OpenTelemetry + DIY backend** | Full control, vendor-neutral.                 | We are not running our own observability stack.                     |
| **Console logs in Vercel**      | Free.                                         | Useless past day 2.                                                 |

**Switch trigger**: None expected. Sentry is the right shape for indie scale.

---

### 2.13 Analytics + feature flags → **PostHog**

**Pros**

- Product analytics + flags + session replay + experiments + funnels in one tool.
- Self-hostable later if cost demands.
- API + SDK for both browser and server; works from RSC.
- Flags can target by user/org property — exactly what we need for plan-gated rollouts.

**Cons**

- Browser SDK is heavy (~50KB+); need to lazy-load.
- Self-hosting is non-trivial (it's a real Postgres + ClickHouse + Redis + Plugin Server stack).
- Splitting analytics from flags later is annoying — once events are in PostHog, your funnels live there.

**Alternatives**

| Option                             | Pros                             | Cons                                                     |
| ---------------------------------- | -------------------------------- | -------------------------------------------------------- |
| **Amplitude / Mixpanel**           | Best-in-class analytics.         | No flags or replay; we'd need a separate tool for flags. |
| **LaunchDarkly**                   | Best-in-class flags.             | Expensive; analytics and replay still separate.          |
| **Statsig**                        | Flags + experiments + analytics. | Similar shape to PostHog; less self-hostable.            |
| **Vercel Analytics + Edge Config** | Native to deploy target.         | Light analytics only; no funnels, no flags-as-platform.  |
| **Plausible / Fathom**             | Privacy-first traffic analytics. | No product analytics, no flags, no replay.               |

**Switch trigger**: Flag traffic outgrows PostHog's pricing → LaunchDarkly. Analytics need that PostHog can't fulfill (rare) → Amplitude.

---

### 2.14 Cache + rate limit → **Upstash Redis**

**Pros**

- Serverless-friendly (HTTP API; no persistent TCP connection from edge runtimes).
- `@upstash/ratelimit` library makes sliding-window rate limits one constructor call.
- Pay-per-request pricing; cheap at indie scale.

**Cons**

- HTTP latency is higher than direct Redis — for hot caches, every request adds round-trip.
- Limited Redis feature set (no Lua scripting in some plans, smaller memory).
- Vendor lock for the HTTP-mode wrapper specifically (regular Redis client also works).

**Alternatives**

| Option                                 | Pros                        | Cons                                                                  |
| -------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| **Cloudflare KV / Durable Objects**    | Globally replicated; cheap. | Eventually consistent (KV); Durable Objects require new mental model. |
| **Vercel KV (Upstash under the hood)** | Native Vercel UX.           | Just Upstash with a markup.                                           |
| **Redis Cloud / ElastiCache**          | Full Redis.                 | TCP only — awkward from serverless; pricing heavier.                  |
| **Postgres for rate limit**            | One fewer service.          | Antipattern at any volume — locks the row, kills DB QPS.              |
| **DynamoDB w/ TTL**                    | AWS-native.                 | Different model; harder to reason about per-second windows.           |

**Switch trigger**: Per-request HTTP latency hurts a hot path → migrate that specific cache to a TCP-mode Redis. Otherwise stay.

---

### 2.15 Object storage → **Cloudflare R2**

**Pros**

- S3-compatible API — every existing S3 client works.
- **Zero egress fees** — huge for serving documents back to users.
- Pricing is simple and indie-friendly.

**Cons**

- Lifecycle rules / object versioning are not as feature-complete as S3.
- Some niche S3 features (Object Lambda, request payment) are unsupported.
- Cloudflare's region story is "everywhere," which sometimes obscures latency reasoning.

**Alternatives**

| Option                         | Pros                                                             | Cons                                                          |
| ------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| **AWS S3**                     | The reference; every feature; lifecycle / replication / Glacier. | Egress fees can dominate cost for content-heavy apps.         |
| **Supabase Storage**           | Already in the same console; signed URLs work.                   | Not as cheap for high-volume reads; tied to Supabase regions. |
| **Backblaze B2**               | Cheapest cold storage.                                           | Slower; smaller ecosystem.                                    |
| **Bunny.net Storage / CDN**    | Good media-CDN combo.                                            | Smaller; less S3-API parity.                                  |
| **Cloudflare Images / Stream** | Specialized for images / video.                                  | Not general-purpose object storage.                           |

**Switch trigger**: Need lifecycle / object lock / detailed audit features that R2 doesn't offer → S3.

---

### 2.16 AI SDK + provider → **Vercel AI SDK + Anthropic Claude**

**Pros (Vercel AI SDK)**

- Provider-agnostic streaming, tool calls, and structured-output primitives — switching providers is one constructor call.
- React hooks (`useChat`, `useCompletion`) handle the streaming UX, including stop / regenerate.
- TypeScript types are thorough for tool schemas.

**Pros (Claude)**

- Reasoning quality on complex tasks is the current frontier.
- 200K-token context windows make RAG simpler (fewer chunking hacks).
- Strong behavior on long tool-use chains (the kind of agentic flows our PRD describes).

**Cons**

- Vercel AI SDK occasionally lags adding very-new model features (delta of days to weeks).
- Anthropic API has lower TPS (transactions/sec) caps on smaller tiers vs OpenAI.
- Pricing per token is higher than OpenAI's smaller models; mitigated by quotas + prompt caching.

**Alternatives**

| Option                                    | Pros                                             | Cons                                                                       |
| ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| **OpenAI direct (no AI SDK)**             | First-party SDK; latest features instantly.      | We rewrite streaming UX per project; provider lock-in.                     |
| **LangChain / LangGraph**                 | Big abstractions for chains, agents, retrievers. | Heavy; the "spaghetti at the seams" problem; opinionated runtime.          |
| **LlamaIndex**                            | RAG-first abstractions.                          | Strong on retrieval; weaker on streaming UX.                               |
| **Direct Anthropic SDK**                  | First-party SDK, latest features instantly.      | We re-implement the Vercel AI SDK's hooks; harder to swap providers later. |
| **OpenRouter**                            | One API across many providers.                   | Adds a hop and pricing markup.                                             |
| **Self-host (vLLM / TGI + open weights)** | Full control, no per-token cost.                 | Operating an LLM ourselves is out of scope for indie.                      |

**Switch trigger**: A required model is not on the AI SDK _and_ is critical to a feature → drop to that provider's direct SDK for that one route. Otherwise stay.

---

### 2.17 Vector store → **Postgres `pgvector`**

**Pros**

- Same database as everything else — joins between embeddings and rows are SQL.
- One operator (`<->`, `<=>`, `<#>`) to compute distance; HNSW and IVFFlat indexes built in.
- No extra service to provision; transactional consistency between docs and their chunks.

**Cons**

- Recall and latency at ≥1M vectors require careful index tuning (HNSW parameters, `lists` for IVFFlat).
- Memory pressure on Postgres scales with index size — larger Supabase plan required as corpus grows.
- Lacks specialized features like hybrid search (BM25 + vector) without extensions / extra glue.

**Alternatives**

| Option                         | Pros                                           | Cons                                                                               |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Pinecone**                   | Purpose-built; great recall/latency; zero ops. | Extra service + bill; data lives outside our DB; harder transactional consistency. |
| **Weaviate**                   | Hybrid search built in; self-hostable.         | Adds a service to operate.                                                         |
| **Qdrant**                     | Rust-native; fast; good DX.                    | Adds a service to operate.                                                         |
| **Chroma**                     | Local/embedded; great for prototypes.          | Production story is weaker.                                                        |
| **Turbopuffer**                | Cheap object-storage-backed vectors.           | Newer; smaller ecosystem.                                                          |
| **Elasticsearch / OpenSearch** | Vector + full-text in one.                     | Heavyweight to operate; overkill until we need both.                               |

**Switch trigger**: Crossing ~1M vectors _and_ recall/latency degrades on `pgvector` HNSW → Pinecone or Turbopuffer for that index, while keeping other data in Postgres.

---

## Part 3 — How these choices reinforce each other

Each layer is independent enough to swap, but together they form a single workflow:

1. A request arrives at **Next.js** Server Action.
2. **Supabase Auth** resolves the user; **Postgres + RLS** enforces org isolation.
3. **Stripe** state determines entitlement; **Upstash** enforces rate limit.
4. The action calls the **Vercel AI SDK** which streams from **Claude**, hitting **pgvector** for retrieval.
5. **Resend** fires any transactional email side effect.
6. **PostHog** records the event; **Sentry** captures any error.
7. Long uploads go to **Cloudflare R2**, processed asynchronously by jobs (TBD: Cloudflare Queues per ADR future entry).
8. All of this is built, type-checked, linted, tested, and deployed via the **pnpm + Turborepo + ESLint + Prettier + Vitest + GitHub Actions + Vercel** chain we just laid down.

The lock-in is intentional. Re-deciding mid-flight is the failure mode.

---

## Part 4 — What this Phase 0 setup did _not_ include (and why)

| Deferred to | Item                                                | Why later                                                                              |
| ----------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Phase 1     | `apps/web` (Next.js app)                            | The whole point of Phase 0 is "no product code yet."                                   |
| Phase 1     | ADR 0002 (auth model), ADR 0003 (multi-tenant data) | Written when we have a real schema to commit to.                                       |
| Phase 1     | `packages/db` (Supabase migrations)                 | Created with the first migration, not preemptively.                                    |
| Phase 2     | Stripe integration, webhook idempotency table       | Needs real auth + org tables first.                                                    |
| Phase 3     | Sentry / PostHog wiring                             | Cheaper to add to a real app than to a stub.                                           |
| Future      | Husky / lint-staged pre-commit hooks                | Single-developer repo; CI is the gate. Add only if commits start arriving unformatted. |
| Future      | Changesets / publishing                             | Nothing publishes yet; private workspace.                                              |
| Future      | Storybook                                           | Will live next to `packages/ui` once real components exist.                            |
| Future      | Playwright E2E                                      | Lands in Phase 1 after the first real flow exists to test.                             |

---

## Part 5 — Reading list (commit to one per week)

- **Next.js App Router & RSC**: [nextjs.org/learn](https://nextjs.org/learn)
- **TypeScript strict flags**: TypeScript 5.x release notes for `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **typescript-eslint flat config**: typescript-eslint.io migration guide.
- **Supabase + Next.js SSR**: official `@supabase/ssr` cookie-pattern guide.
- **Stripe webhook reliability**: Stripe docs, "Best practices for webhooks."
- **pgvector indexing**: Supabase blog series on HNSW vs IVFFlat trade-offs.
- **PostHog feature flags**: PostHog docs on "Server-side feature flags" (RSC pattern).
- **Vercel AI SDK**: `sdk.vercel.ai` — start with `useChat` and `streamText`.

---

**End of 0001-phase-0-foundation.** Update this file as decisions evolve; supersede with `0002-…` when a new phase teaches us something this entry got wrong.
