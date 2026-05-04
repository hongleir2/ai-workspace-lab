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

### In progress
- Sprint 1 remainder: auth refinement, protected dashboard UX beyond org bootstrap

### Up next (Sprint 2)
- Billing: Stripe Free + Pro plans, Checkout, idempotent webhook handler, billing portal
- Entitlements: server-side plan/quota enforcement in `packages/entitlements`
- `subscriptions`, `stripe_events`, `plans`, `plan_limits` tables

---

## Key commands

```bash
pnpm verify           # lint + typecheck + test — must be green before push
pnpm dev              # start all apps
pnpx supabase start   # start local Postgres (Docker required)
pnpm --filter @ai-workspace-lab/db db:migrate   # apply migrations (uses DATABASE_URL)
pnpm --filter @ai-workspace-lab/db db:generate  # generate migration from schema changes
pnpm test             # unit + integration tests (DB tests need DATABASE_URL)
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
