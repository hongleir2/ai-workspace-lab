# Agent Project Brief

**Update this file at the start of each sprint.** A new agent should read this + `CLAUDE.md` and be ready to work.

---

## What we're building

Multi-tenant AI SaaS. Users upload documents → background processing → ask AI questions → get cited answers. Paid tiers via Stripe. Modular monolith (Next.js 15 + Supabase Postgres + Drizzle ORM).

Full spec: `docs/product/prd.md` | ERD: `docs/product/erd.md` | Routes: `docs/product/frontend-page-map.md`

---

## Current status (last updated: 2026-05-17 Day 51)

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
- [x] **Day 23 — Entitlements service**: `packages/entitlements` — `getOrganizationPlan`, `getPlanLimits`, `getCurrentBillingPeriod`, `checkEntitlement`, `checkQuota`, `assertFeatureAllowed`; `EntitlementError` with typed codes (`FEATURE_NOT_INCLUDED | QUOTA_EXCEEDED | NO_ACTIVE_SUBSCRIPTION`); unit tests (mocked DB) + integration tests (real Postgres); reads from local `subscriptions`/`plans`/`plan_limits`/`usage_counters` tables; no Stripe
- [x] **Day 24 — Usage service**: `packages/usage` — `recordUsageEvent`, `incrementUsageCounter`, `getUsageForFeature`, `getUsageSummaryForOrganization`, `recordUsageWithCounter` (transaction: event insert with `ON CONFLICT DO NOTHING` on `idempotency_key`, then counter upsert when inserted); integration test proves duplicate idempotency key does not double-count
- [x] **Day 26 — Stripe tables + env**: migration 0007 creates `billing_customers` (org ↔ Stripe customer bridge, ON DELETE CASCADE) and `stripe_events` (webhook idempotency log, `processing_status` CHECK constraint); wires FK `subscriptions.billing_customer_id → billing_customers.id` (ON DELETE SET NULL); Drizzle schemas + integration tests for both tables; `.env.example` Stripe section updated to Day 26+
- [x] **Day 27 — Stripe checkout + billing page + nav consolidation**: `packages/billing` service layer (`getOrCreateStripeCustomer`, `createCheckoutSession`, `createBillingPortalSession`, `mapStripePriceToPlan`) with 7 unit tests; `/settings/billing` page shows current plan (read-only for members, Upgrade buttons + Manage Billing for owner); `/settings/billing/success` post-checkout landing; `/settings/usage` page (moved from `/usage`); Usage + Billing removed from main sidebar, added to Settings sub-nav; standalone `/app/[orgSlug]/billing` and `/app/[orgSlug]/usage` routes deleted
- [2026-05-16] Day 28–30: Stripe webhook handler (idempotent, 9 unit tests), billing success/canceled pages with analytics stubs, ADR 0008, runbook
- [2026-05-16] **Day 31 — Sentry setup**: `@sentry/nextjs` added to `apps/web`; browser/server/edge SDK initialization files; `withSentryConfig` source-map upload config for org `leixingtech` project `ai-workspace-lab`; root `app/error.tsx` + `app/global-error.tsx`; settings error boundary now captures to Sentry; `/dev/sentry-test` page captures client and server test errors in development only; org layout attaches safe Sentry context (`user.id`, `organization.id`, `organization.slug`, membership role only)
- [2026-05-16] **Day 32 — PostHog analytics**: `packages/analytics` wrapper (`identifyUser`, `identifyOrganization`, `captureEvent`, `resetAnalytics`) + 9 unit tests; `PostHogProvider` client component with App Router pageview tracking via `usePathname`/`useSearchParams`; `AnalyticsIdentity` identifies user+org on every `/app/[orgSlug]` entry; `captureServerEvent` posthog-node utility for server actions; server events: `user_signed_up`, `user_signed_in`, `organization_created`; client events: `dashboard_viewed`, `billing_viewed`, `checkout_started`, `checkout_success_viewed`, `checkout_canceled`, `billing_portal_opened`; 6 new unit tests
- [2026-05-16] **Day 33 — Feature flag wrapper**: `packages/analytics` `FeatureFlag` union type + `FLAG_DEFAULTS` + `isFeatureEnabled()` client helper; `getServerFeatureFlag()` server helper (posthog-node, same fail-safe pattern as captureServerEvent); `document_upload_enabled` flag wired into dashboard checklist — locked row when off, live link when on; 8 new unit tests
- [2026-05-16] **Day 34 — Observability ADR**: `docs/adr/0009-observability-and-product-analytics.md` covering Sentry purpose, PostHog event taxonomy, user/org context policy, privacy rules, feature flag strategy, alert ideas; README updated with local observability env setup
- [2026-05-16] **Day 35 — Dashboard widgets**: `/app/[orgSlug]` dashboard replaced with real data widgets — org card, plan card (name + status badge + billing interval), usage-this-period bars via `getOrganizationUsageOverview`, recent docs/AI session placeholder cards, getting-started checklist (feature-flag gated), upgrade CTA banner for free orgs; switched from `requireUser`+`getOrganizationBySlug` to `requireMembership`
- [2026-05-16] **Day 36 — Storage + documents tables**: migrations 0009 (`storage_objects`) and 0010 (`documents`); full ERD §8.1/§8.2 columns; status enums (`storage_object_status`, `document_status`, `document_source_type`); all required indexes (UNIQUE on bucket+object_key, org+created_at, org+status, created_by+created_at, checksum); `set_updated_at` trigger on documents; RLS enabled with SELECT policy for active org members on both tables; Drizzle schemas + type/table exports; 9 integration tests; ERD Mermaid corrected (composite UNIQUE replaces standalone UQ on object_key)
- [2026-05-16] **Day 37 — Object storage service (`packages/storage`)**: `StorageProvider` interface with R2 (AWS S3-compatible) and Supabase Storage implementations; explicit `STORAGE_PROVIDER=r2|supabase` env var selection; `createUploadTarget` (presigned upload URL, org-scoped key `organizations/{orgId}/uploads/{yyyy}/{mm}/{uuid}.{ext}`), `uploadObject`, `getObjectMetadata`, `deleteObject`, `createStorageObjectRow`; `assertCanUploadToOrg` auth boundary (active org membership check); `validateFileType` (extension + MIME allowlist for pdf/txt/md), `validateFileSize`, `getMaxFileSizeMb` (reads `max_file_size_mb` plan limit via entitlements); `StorageError` typed error class; 19 unit tests (15 validation + 4 service)
- [2026-05-17] **Day 38 — Document upload API endpoint** (`POST /api/orgs/[orgSlug]/documents`): creates document row + presigned R2 URL, returns 429 on quota exceeded (document_count limit), 402 on no subscription, 403 on feature disabled, 200 on success; 2-phase client flow (POST for metadata, PUT file to presigned URL); analytics event `document_upload_started`; 17 unit tests covering all error paths
- [2026-05-17] **Day 39 — Document list, upload, and detail pages**: `/documents` page lists org docs (status badges, org filter by id+deletedAt), empty state with upload CTA, `PageAnalytics` for `documents_viewed`; `/documents/new` upload form (client component, two-phase flow, quota/billing/feature error messages, `document_upload_failed` / `document_uploaded` events); `/documents/[documentId]` detail page (status badge, file metadata, formatted size/date, `notFound()` on org/soft-delete mismatch, `document_detail_viewed` event); all pages use `requireMembership` + `force-dynamic`; analytics: 4 events total
- [2026-05-17] **Day 40 — Document ownership tests + ADR 0010 + dashboard entitlement fix**: 4 unit tests (service: FILE_TOO_LARGE, NOT_AUTHORIZED cross-org, organizationId correctness; route: NOT_AUTHORIZED → 402); 3 integration tests (document belongs to org, cross-org isolation, soft-delete exclusion); `docs/adr/0010-file-storage-and-document-ownership.md`; dashboard now checks `checkEntitlement(orgId, 'document_uploads')` server-side — shows "Document uploads are not enabled for your account" in the Recent documents card and "Not included in your plan / Upgrade" in the checklist when the feature flag is on but the plan doesn't include the feature; 151 unit tests passing
- [2026-05-17] **Day 42 — Job service abstraction**: `packages/jobs/src/job-service.ts` with 8 named functions (`createJob`, `claimNextJob`, `startJobAttempt`, `completeJob`, `failJob`, `retryJobWithBackoff`, `deadLetterJob`, `cancelJob`); idempotency via `ON CONFLICT DO NOTHING` on `idempotencyKey`; exponential backoff formula `min(60 × 5^(n−1), 86400)`; 17 unit tests covering all 8 functions; `worker.ts` refactored to delegate to service functions; all 8 functions re-exported from `packages/jobs/src/index.ts`
- [2026-05-17] **Day 43–45 — Background job processing pipeline**: `downloadObject` added to both storage providers (R2 stream, Supabase blob); `packages/jobs` wired with db+storage deps; `chunkText` (paragraph → sentence → sub-chunk, 1500-char limit), `extractText` (txt/md/pdf), `processDocumentHandler` (load → mark processing → extract → chunk → delete+insert for idempotency → mark ready/failed), `runWorkerOnce` (FOR UPDATE SKIP LOCKED claim, exponential backoff capped 24h, dead-letter); upload → job wiring (`createProcessDocumentJob` with ON CONFLICT DO NOTHING, document status now `queued`); internal worker trigger route `POST /api/internal/run-worker` (QStash `upstash-signature` verification via `Receiver` as primary auth, `WORKER_SECRET` bearer fallback for manual/cron); **QStash push trigger** (`apps/web/src/lib/jobs/trigger.ts`) — fires immediately on upload, no-ops without `QSTASH_TOKEN`; **`AutoRefresh` component** — admin jobs page polls every 5 s, document detail page polls every 3 s while non-terminal (stops on `ready`/`failed`); `/admin/jobs` page shows all job statuses; `requirePlatformAdmin()` email-allowlist guard; `WORKER_SECRET`+`ADMIN_EMAILS` in env.ts + .env.example; 22 new unit tests; ADR 0011; `docs/runbooks/queue-backlog.md`; **extra — landing page + reliability fixes**: `/(marketing)/page.tsx` full 7-section landing page (Hero aurora, Problem strip, How It Works, Features grid, Testimonials, Pricing from DB, Final CTA); zombie job reaper (`reapZombieJobs(120s)` marks stuck jobs as `failed` + updates document status to `failed/TIMEOUT`); PDF page limit (`{ max: 10 }`); await QStash trigger; `getOrganizationPlan` guard for free-tier orgs; Vercel cron `0 0 * * *`; `CRON_SECRET` auth on run-worker route; soft-delete confirmation dialog for failed documents (`DeleteDocumentButton` + `deleteDocument` server action); **extra — business-level structured logging**: new `packages/logger` shared package (`@ai-workspace-lab/logger`) wrapping `@axiomhq/js` + `@axiomhq/logging` with `createLogger(module, context?)` factory; environment-aware log levels (`debug` in dev/preview via `VERCEL_ENV`, `info` in production); `x-trace-id` injected in middleware (12-char nanoid) propagated through request/response headers; `/api/axiom` circular-log guard added to middleware; structured logs added to `packages/billing` (webhook-handler + service, 11 events), `packages/entitlements` (service, 3 events), `packages/usage` (service, 2 events), `packages/storage` (service, 4 events), `packages/jobs` (worker + process-document handler, 15 events including debug traces covering full pipeline); traceId-threaded logs in `/api/orgs/[orgSlug]/documents`, `/api/webhooks/stripe`, `/api/internal/run-worker`; `organizationId` added to `ClaimedJob`/`ZombieJob` interfaces and SQL queries; `docs/runbooks/logging.md` tutorial with APL queries + 5 tracing workflows; README, PRD, and ERD updated for Axiom + QStash; **extra — token-aware chunking + js-tiktoken**: replaced char-based `chunkText` (1500-char limit) with `chunkTextByTokens` using `js-tiktoken` (pure-JS, no WASM); paragraph → sentence → token-budget packing with `cl100k_base` encoding (`text-embedding-3-small`); `maxTokens: 700`, `overlapTokens: 100`; regex sentence splitter handles Latin + CJK terminators (`[.!?。？！；…]`); oversized sentences hard-split at token boundaries; null-byte stripping for PDF text (Postgres rejects `U+0000`); migration 0016 adds `chunking_strategy`, `start_char_index`, `end_char_index` to `document_chunks`; `CHUNKING_STRATEGY = 'paragraph_sentence_token_v1'`; switched from `tiktoken` (WASM, breaks Next.js webpack) to `js-tiktoken` (drop-in pure-JS); internal handler exports pruned from `packages/jobs` public API; 13 new unit tests; `scripts/clean-docs-and-jobs.ts` utility to wipe test data from local or cloud Supabase
- [2026-05-17] **Day 46 — AI chat schema**: `prompt_versions`, `ai_sessions`, `ai_messages`, and optional `rate_limit_events` migration 0014; seed rows for `document_qa` v1 and `general_chat` v1; RLS + indexes for AI session/message lookup; migration 0015 adds a typed rate-limit action enum plus tenant-safe composite constraints so messages match their session org and parent messages stay in the same session; integration tests cover prompt seeds, session/message inserts, negative FK cases, and rate-limit rows
- [2026-05-17] **Day 47–50 — AI chat feature**: `packages/ai` service wrapper (`streamChatCompletion`, `estimateCost`, `normalizeTokenUsage`, `buildPromptFromMessages`, `AiError`) using OpenAI via Vercel AI SDK (`@ai-sdk/openai`, `gpt-4o-mini` default, 4096 max-token default); `POST /api/orgs/[orgSlug]/chat` with full security stack (auth → membership → feature flag `ai_chat_enabled` → `assertFeatureAllowed(ai_messages)` → Upstash rate limit [free: 5/min, pro: 30/min] → session ownership → stream); `onFinish` stores assistant message with token counts + `estimateCost` in `ai_messages.cost_micro_usd` + `recordUsageWithCounter` (idempotency key = user message ID); `/app/[orgSlug]/ai` session list with server action `createChatSession`; `/app/[orgSlug]/ai/sessions/[sessionId]` streaming chat UI (`useChat` hook, quota badge, upgrade CTA when quota exceeded); analytics events `ai_chat_started`, `ai_chat_completed`, `ai_chat_failed`, `quota_exceeded`; `@upstash/ratelimit` + `@upstash/redis` installed; `docs/adr/0012-ai-streaming-and-cost-control.md`; `docs/runbooks/ai-provider-outage.md`; 25 new unit tests
- [2026-05-17] **Day 51 — Enable pgvector (ERD sync)**: pgvector was already enabled in migration 0013 (`CREATE EXTENSION IF NOT EXISTS vector`); `document_chunks` already has `embedding vector(1536)`, `embedding_model`, and HNSW cosine index (m=16, ef_construction=64); ERD §8.6 updated to reflect actual constraint `UNIQUE(document_id, chunk_index)`, actual HNSW index parameters, and three columns added by migration 0016 (`chunking_strategy`, `start_char_index`, `end_char_index`)

### In progress
- Sprint 9: embeddings and RAG v1 with cited answers

### Up next
- Day 52+: embedding pipeline (call text-embedding-3-small, store vectors, similarity search for RAG)

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
