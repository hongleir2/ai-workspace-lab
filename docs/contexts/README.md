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

### In progress
- Sprint 1 remainder: auth integration, protected dashboard, organization creation UI

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

Full rules: `CLAUDE.md`

---

## Deeper context (read when relevant)

| Need | File |
|------|------|
| Full feature requirements | `docs/contexts/product-overview.md` |
| All tables + columns + indexes | `docs/contexts/data-model.md` |
| Sprint-by-sprint plan | `docs/contexts/sprint-roadmap.md` |
| Every frontend route | `docs/product/frontend-page-map.md` |
| Locked tech decisions | `docs/adr/0001-stack-choice.md` |
| Auth model + RLS | `docs/adr/0005-authentication-model.md` |
| How we built each phase | `docs/journal/` |
