# Sprint Roadmap

> Phase overview and current status. Full task lists for each sprint: `docs/product/sprint-plan.md`

---

## Phase overview

```
Sprint 0         — Project setup                    ✅ Done
Sprint 1–2       — Auth + tenant boundary           🔄 In progress
Sprint 3–4       — Plans, entitlements, billing     ✅ Done
Sprint 5–6       — Observability + file storage     🔄 In progress
Sprint 7–8       — Async jobs + AI chat MVP         Upcoming
Sprint 9–10      — Embeddings + RAG                 Future
Sprint 11–14     — Admin, emails, hardening         Future
Sprint 15–18     — Electron desktop                 Future
Sprint 19–21     — Real-time + collaboration        Future
Sprint 22–24     — Performance + launch             Future
```

---

## Sprint 0 — Project setup ✅

**Outcome:** Clean monorepo skeleton, CI, deploy.

- pnpm workspaces + Turborepo + Biome + Vitest + Playwright
- Next.js 15 app shell, Tailwind, TypeScript
- CI: lint → typecheck → test
- ADRs: stack choice, repo structure, modular monolith

---

## Sprint 1 — Auth, user model, protected dashboard 🔄

**Outcome:** User can sign up, sign in, access protected dashboard.

Done:
- `users` table (migrations 0000–0001, Drizzle schema, integration test)
- `organizations`, `organization_memberships`, `audit_logs` (migrations 0002–0004, RLS, integration tests)
- Local Supabase dev env
- **`requireUser()` / `requireMembership()`** server helpers wired to onboarding + `/app/[orgSlug]`
- **Organization creation**: server action, create-org UI, onboarding + app redirect routers (`getUserOrganizations`)
- **Day 18**: `OrgLayout` threads real org data to sidebar; `OrganizationSwitcher` uses live orgs (not mock); dashboard shows real org name + getting-started checklist; create-org form throttled with `useFormStatus`
- **Day 19**: `/app/[orgSlug]/settings` shell — left vertical sub-nav, `/settings/general` (org name/slug/created/role, read-only), `/settings/members` + `/settings/billing` + `/settings/danger` placeholder cards, `loading.tsx` + `error.tsx` scoped to segment
- **Day 20**: Tenancy isolation integration tests (`tenancy.integration.test.ts` — org creator becomes owner, cross-user data isolation, per-user org lists, audit log field verification); `requireRole` full 3×3 combinatorial unit tests (owner/admin/member × owner-only/owner+admin/all-member routes); ADR 0006: multi-tenant data model; schema tests renamed to `*.integration.test.ts`; `pnpm test:integration` script + CI `test-integration` job
- ADR 0005: authentication model (referenced in README)

Remaining:
- Supabase Auth package polish (`packages/auth` as listed in backlog)
- Onboarding analytics events (`onboarding_started`, `organization_created`, `onboarding_completed`)

---

## Sprint 2 — Organizations, memberships, tenant UI

**Outcome:** User can create org, invite members, switch orgs.

- Member invite flow (token, expiry, server-validated)
- Org switcher UI
- `invitations` table

*(Organization creation landed in Sprint 1 / Day 17.)*

---

## Sprint 3 — Plans, entitlements, local free/pro gating

**Outcome:** Server can compute whether an org is on Free or Pro and gate actions.

Done:
- **Day 21**: `plans`, `plan_limits`, `subscriptions`, `usage_events`, `usage_counters` tables — migration 0005, Drizzle schemas, integration tests for UNIQUE constraints (partial index on active subscriptions, idempotency key, org+feature+period)
- **Day 22**: Seed script for Free/Pro plans + limits (`pnpm db:seed`); `createOrganization` auto-inserts a free subscription in the same atomic transaction; migration 0006 adds missing `plans_is_active_idx` + seeds `free` plan row for production/CI deployments; subscription insert guarded with `.returning()` null-check; `service.integration.test.ts` asserts subscription row is created atomically
- **Day 23**: `packages/entitlements` — `assertFeatureAllowed(orgId, featureKey)` checks plan inclusion + quota in 3 DB queries; `checkEntitlement`, `checkQuota` as lower-level primitives; `EntitlementError` with codes `FEATURE_NOT_INCLUDED | QUOTA_EXCEEDED | NO_ACTIVE_SUBSCRIPTION`; unit tests (mocked DB) + 12 integration tests (real Postgres)
- **Day 24**: `packages/usage` — records immutable `usage_events` (idempotent via unique `idempotency_key`) and upserts `usage_counters`; `recordUsageWithCounter` composes both in one transaction; integration test for duplicate-key no-op
- **Day 25**: Usage overview page (`/app/[orgSlug]/usage`) — real plan + per-feature limit/used/period data via `getOrganizationUsageOverview` (parallel counter queries, no N+1); ADR 0007 (entitlements + usage limits contract); `user-menu` sign-out + nav wired; auth user sync fixed for duplicate-email conflict on local DB reset

Remaining:
- Entitlement checks wired to AI and upload endpoints

---

## Sprint 4 — Stripe Checkout, subscriptions, webhook idempotency ✅

**Outcome:** User can upgrade to Pro; webhook updates app state idempotently.

Done:
- **Day 26**: `billing_customers` + `stripe_events` tables (migration 0007); Drizzle schemas + integration tests; `.env.example` Stripe section updated
- **Day 27**: `packages/billing` service layer (`getOrCreateStripeCustomer`, `createCheckoutSession`, `createBillingPortalSession`, `mapStripePriceToPlan`) with 7 unit tests; `/settings/billing` page with Upgrade/Manage buttons; billing portal link for paid orgs; nav consolidation
- **Day 28**: Stripe webhook endpoint at `/api/webhooks/stripe` — signature verification, idempotent event processing via `stripe_events` table; handles `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`; 9 unit tests
- **Day 29**: Billing success (`/settings/billing/success`) and canceled (`/settings/billing/canceled`) pages with analytics event stubs (`trackCheckoutSuccessViewed`, `trackCheckoutCanceled`, `trackBillingPortalOpened`)
- **Day 30**: ADR 0008 (webhook idempotency design), ops runbook for webhook failures, page map corrections, docs/contexts sync

---

## Sprint 5 — Observability, analytics, feature flags

**Outcome:** Frontend + backend errors in Sentry; activation funnel in PostHog.

Done:
- **Day 31**: Sentry for `apps/web` — `@sentry/nextjs`, browser/server/edge SDK initialization, source-map upload config via `withSentryConfig`, root `app/error.tsx` and `app/global-error.tsx`, development-only `/dev/sentry-test`, and safe authenticated org context (`user.id`, `organization.id`, slug, role only).

Remaining:
- Add `SENTRY_AUTH_TOKEN` in deployed environments to upload readable production source maps
- PostHog: client + server event capture, core events
- One feature flag (e.g. `rag_v1_enabled`)

---

## Sprint 6 — File storage + document upload MVP

**Outcome:** User can upload a document; it appears with status `queued`.

Done:
- **Day 35**: Real dashboard widgets — org card, plan card, usage bars, placeholder cards, upgrade CTA
- **Day 36**: `storage_objects` (migration 0009) + `documents` (migration 0010) — full column spec, enums, indexes, RLS, Drizzle schemas, 9 integration tests

Remaining:
- Upload endpoint: validate type/size, entitlement check, create doc + job row
- Document list UI with status

---

## Sprint 7 — Background jobs + processing pipeline

**Outcome:** Uploaded document reaches `ready` status asynchronously.

- `jobs`, `job_attempts` tables
- Worker: extract text → chunk → embed → store chunks
- Retry on transient failure; `failed` state visible to user

---

## Sprint 8 — AI chat MVP (streaming, rate limits, quotas)

**Outcome:** User can ask a question and get a streaming answer; quota enforced.

- `ai_sessions`, `ai_messages`, `usage_events`, `usage_counters` tables
- `/api/ai/chat`: auth → membership → entitlement → quota → rate limit → model call
- Streaming via Vercel AI SDK; token usage recorded
- Rate limit via Upstash Redis

---

## Sprint 9 — Embeddings + RAG v1

**Outcome:** AI answers include source citations from uploaded documents.

- `document_chunks` with pgvector embeddings
- Similarity search filtered by `organization_id`
- `ai_message_sources` linking answers to chunks

---

## Sprint 10 — Document collections + scoped Q&A

**Outcome:** User can group documents and ask AI over a specific collection.

- `document_collections`, `document_collection_items` tables
- Collection scoped retrieval

---

## Sprint 11 — Admin / debug operations

- Failed jobs view + retry action
- Usage dashboard (top orgs, cost estimates)
- Webhook failure visibility

---

## Sprint 12 — Transactional emails + notifications

- `notifications`, `email_events` tables
- Invite email, document-ready, onboarding nudge via Resend

---

## Sprint 13–14 — AI feedback + MVP hardening / private beta

- `ai_feedback` table; thumbs up/down
- Prompt versioning
- Runbooks: Stripe failures, queue backlog, AI provider outage
- Private beta readiness checklist

---

## Sprint 15–18 — Electron desktop

- `desktop_installations`, `desktop_sessions`, `desktop_uploads` tables
- Secure IPC (context isolation, no raw Node in renderer)
- Sign-in, org selection, local file upload
- Server-side entitlement check; crash reporting; auto-update pipeline

---

## Sprint 19–21 — Real-time + collaboration

- SSE-based live document processing status
- `realtime_rooms`, `room_participants` tables
- Reconnect handling; optional presence + shared AI session view

---

## Sprint 22–24 — Performance + launch

- Query plan analysis + index tuning
- Entitlement cache (safe TTL)
- Load test report
- Landing page + onboarding funnel + launch metrics dashboard
