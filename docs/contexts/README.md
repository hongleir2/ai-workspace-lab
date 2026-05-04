# Agent Project Brief

**Update this file at the start of each sprint.** A new agent should read this + `CLAUDE.md` and be ready to work.

---

## What we're building

Multi-tenant AI SaaS. Users upload documents → background processing → ask AI questions → get cited answers. Paid tiers via Stripe. Modular monolith (Next.js 15 + Supabase Postgres + Drizzle ORM).

Full spec: `docs/product/prd.md` | ERD: `docs/product/erd.md` | Routes: `docs/product/frontend-page-map.md`

---

## Current status (last updated: 2026-05-03)

### Done
- [x] Sprint 0 — Repo scaffold: pnpm workspaces, Turborepo, Biome, Vitest, Playwright, CI
- [x] Sprint 1 partial — `users` table + migration + integration test
- [x] Tenant boundary migrations: `organizations`, `organization_memberships`, `audit_logs` (migrations 0002–0004, Drizzle schema, RLS policies, integration tests)
- [x] Local Supabase dev environment (`pnpx supabase start`)
- [x] **Day 17 — Organization domain service**: `slugify`/`generateUniqueSlug`, `createOrganization` (single transaction), `getOrganizationBySlug`, `getUserOrganizations`, `createAuditLog`; `requireOrganizationBySlug`, `requireMembership`, `requireRole`; wired `/onboarding` + `/app` redirects, create-org form + server action; `/app/[orgSlug]` membership gate (`requireMembership`)
- [x] **Day 18 — Onboarding org dashboard**: fixed double-header in `app/layout.tsx` (now `requireUser()` pass-through); `OrgLayout` threads real org name + user's org list to `AppSidebar` → `OrganizationSwitcher` (removed hardcoded mock orgs); `/app/[orgSlug]` dashboard shows "Welcome to {org.name}" + getting-started checklist skeleton; create-org form throttled with `useFormStatus` to prevent duplicate submissions
- [x] **Day 19 — Settings shell**: `/app/[orgSlug]/settings` multi-page structure with left vertical sub-nav; `/settings/general` displays org name, slug, created date, and current user role (read-only); `/settings/members`, `/settings/billing` placeholder cards; `/settings/danger` owner-only placeholder with destructive styling; `loading.tsx` skeleton + `error.tsx` boundary scoped to settings segment
- [x] **Day 20 — Tenancy tests + ADR 0006**: `tenancy.integration.test.ts` (creator becomes owner, cross-user isolation, per-user org lists, audit log fields); `requireRole` full 3×3 combinatorial unit tests; `docs/adr/0006-multi-tenant-data-model.md`; schema tests renamed to `*.integration.test.ts`; `pnpm test:integration` script + CI `test-integration` job (supabase/setup-cli)
- [x] **Day 21 — Billing tables (DB layer)**: `plans`, `plan_limits`, `subscriptions`, `usage_events`, `usage_counters` — migration 0005, Drizzle schemas, integration tests for UNIQUE constraints (partial index on active subscriptions, idempotency key, org+feature+period)
- [x] **Day 22 — Free plan bootstrap**: seed script (`pnpm db:seed`) for Free/Pro plan rows + limits; `createOrganization` atomically inserts a free subscription in the same transaction; migration 0006 backfills missing `plans_is_active_idx` + seeds `free` plan for CI/production; subscription insert guarded with `.returning()` null-check; `service.integration.test.ts` asserts subscription row is created atomically

### In progress
- Sprint 1 remainder: auth refinement, onboarding analytics events

### Up next (Sprint 3 remainder)
- `packages/entitlements`: `getEntitlement(orgId)` → plan limits, server-side quota enforcement
- Sprint 4: Stripe Checkout, idempotent webhook handler, billing portal, `billing_customers` + `stripe_events` tables

---

## Key commands

```bash
pnpm verify           # lint + typecheck + unit tests — must be green before push
pnpm dev              # start all apps
pnpx supabase start   # start local Postgres (Docker required)
pnpm --filter @ai-workspace-lab/db db:migrate   # apply migrations (uses DATABASE_URL)
pnpm --filter @ai-workspace-lab/db db:generate  # generate migration from schema changes
pnpm test             # unit tests only (*.test.ts, no DB required)
pnpm test:integration # DB integration tests (*.integration.test.ts) — requires supabase start + db:migrate first
```

---

## Rules that matter most

1. **`pnpm verify` must pass before every push.** No exceptions.
2. **Every org-scoped query must filter by `organization_id`.**
3. **No new frontend routes** without adding to `docs/product/frontend-page-map.md` first.
4. **No new DB tables** without an entry in `docs/product/erd.md` (or a new ADR).
5. **Hand-written SQL migrations** must be registered in `packages/db/migrations/meta/_journal.json` — Drizzle's migrator only runs journal entries; SQL files without an entry are silently skipped and tables will not be created.
6. **AI calls must check entitlement + quota + rate limit before the provider call.**
7. **Stripe webhooks must verify signature and be idempotent.**
8. Server-only secrets never reach the client bundle.
9. **No `.js` extensions in relative imports inside `packages/db/src/` or `apps/web/src/`.** Next.js (webpack) cannot remap `.js` → `.ts` for workspace package sources. `moduleResolution: "Bundler"` in tsconfig makes the extension optional — omit it everywhere. (Vitest's Vite resolver works either way; webpack in a Next.js app does not.)

Full rules: `CLAUDE.md`

---

## Locked technology decisions

These are fixed. Changing any layer requires writing a new ADR — never silently swap.

| Layer | Choice | Do not use instead |
|-------|--------|--------------------|
| Web framework | Next.js 15 App Router + React 19 | Remix, SvelteKit |
| Database | Supabase Postgres + Drizzle ORM | Neon, Prisma, raw SQL client |
| Auth | Supabase Auth | Clerk, NextAuth |
| Payments | Stripe Checkout + Customer Portal | Paddle, Lemon Squeezy |
| Email | Resend | SendGrid, SES directly |
| AI | Vercel AI SDK + Anthropic Claude | Direct OpenAI SDK, LangChain |
| Vector | pgvector in Supabase | Pinecone (until pgvector proven insufficient) |
| Cache / rate limit / jobs | Upstash Redis + QStash | Cloudflare KV, self-hosted Redis |
| Object storage | Cloudflare R2 (or Supabase Storage) | S3 directly |
| Styling | Tailwind 3.4 | CSS Modules, Emotion |
| Lint / format | Biome | ESLint + Prettier |
| Monorepo | pnpm workspaces + Turborepo | Nx, Lerna |

Full rationale: `docs/adr/0001-stack-choice.md`

---

## Auth model (read before touching any protected route or DB query)

- **Supabase Auth** owns identity. Our `users` table is the app-level profile, synced on first sign-in.
- **Two Supabase clients exist** — never mix them:
  - `createBrowserClient` — browser only
  - `createServerClient` — Server Components, Route Handlers, Middleware (different cookie APIs for each)
- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS. All app writes to org-scoped tables use the service role. Never expose this key to the client.
- **Anon key** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) is safe in the browser but has no write access to org tables (no INSERT/UPDATE RLS policies for the `authenticated` role).
- **RLS is the safety net**, not the primary gate. App code always filters by `organization_id` first; RLS catches mistakes.
- `requireUser()` — call in every Server Component/Action that needs auth. Returns the user or redirects.
- `requireMembership(orgSlug)` — call in every `/app/[orgSlug]/*` route. Checks active membership.

Full model: `docs/adr/0005-authentication-model.md`

---

## Deeper context (read when relevant)

| Need | File |
|------|------|
| Full feature requirements | `docs/contexts/product-overview.md` |
| All tables + columns + indexes | `docs/contexts/data-model.md` |
| Sprint roadmap + current status | `docs/contexts/sprint-roadmap.md` |
| Full sprint task lists | `docs/product/sprint-plan.md` |
| Every frontend route | `docs/product/frontend-page-map.md` |
| How we built each phase | `docs/journal/` |
