# Sprint Roadmap

> Condensed from `docs/product/sprint-plan.md`. For full task lists per sprint, read the sprint plan.
> 2-week sprints, solo/small team, modular monolith first.

---

## Phase overview

```
Sprint 0        — Project setup               ✅ Done
Sprints 1–2     — SaaS foundation             🔄 In progress
Sprints 3–4     — Billing + observability     Upcoming
Sprints 5–8     — AI chat + documents + RAG   Upcoming
Sprints 9–12    — Admin + hardening           Future
Sprints 13–16   — Electron desktop            Future
Sprints 17–19   — Real-time + collaboration   Future
Sprints 20–24   — Performance + launch        Future
```

---

## Sprint 0 — Project setup ✅

**Outcome:** Clean monorepo skeleton, CI, deploy, ADRs.
- pnpm workspaces + Turborepo + Biome + Vitest + Playwright
- Next.js 15 app shell, Tailwind
- CI: lint → typecheck → test
- ADRs 0001 (stack), 0002 (repo structure), 0003 (modular monolith)

---

## Sprint 1 — Auth + tenant boundary 🔄

**Outcome:** User can sign up, create organization, access protected dashboard.

Done:
- `users` table (migration 0000 + 0001)
- `organizations`, `organization_memberships`, `audit_logs` tables (migrations 0002–0004)
- Drizzle schema + RLS + integration tests for all three

Remaining:
- Supabase Auth integration in `packages/auth`
- Server-side `requireUser()` / `requireMembership()` helpers
- Protected `/app` layout + redirect for unauthenticated users
- Organization creation flow (server action + UI)
- ADR 0005: authentication model

---

## Sprint 2 — Billing + entitlements

**Outcome:** User can upgrade to Pro; paid features gated server-side.

Tasks:
- `plans`, `plan_limits`, `billing_customers`, `subscriptions`, `stripe_events` tables
- Stripe Checkout session creation
- Stripe webhook handler (idempotent on `stripe_event_id`)
- `subscriptions` updated from webhook events
- `packages/entitlements`: `getEntitlement(orgId)` → plan limits
- AI + upload endpoints check entitlement before any work
- Billing portal link for paid orgs
- ADR: billing + entitlements

---

## Sprint 3 — Observability + analytics

**Outcome:** Frontend + backend errors visible in Sentry; activation funnel in PostHog.

Tasks:
- Sentry: Next.js SDK, source maps, error boundary, API route instrumentation
- PostHog: client + server event capture
- Core events: `user_signed_up`, `organization_created`, `document_uploaded`, `ai_chat_*`, `quota_exceeded`, `checkout_*`
- One feature flag (e.g. `rag_v1_enabled`)

---

## Sprint 4 — AI chat MVP

**Outcome:** User can ask a question, get a streaming answer, quota is enforced.

Tasks:
- `ai_sessions`, `ai_messages` tables
- `/api/ai/chat` route: auth → membership → entitlement → quota → rate limit → model call
- Streaming via Vercel AI SDK
- Token usage recorded in `usage_events`
- `usage_counters` for fast quota reads
- Rate limit via Upstash Redis
- Friendly error states

---

## Sprint 5–6 — Document upload + async processing

**Outcome:** Upload a PDF, watch it process, ask AI over it.

Tasks:
- `documents`, `storage_objects` tables + Supabase Storage integration
- Upload endpoint: validate file type/size, entitlement check, create job
- `jobs`, `job_attempts` tables
- Background worker (Cloudflare Queues or QStash): extract text → chunk → embed → index
- Document status visible in UI; failed state + retry

---

## Sprint 7–8 — RAG + citations

**Outcome:** AI answers include source references from uploaded documents.

Tasks:
- `document_chunks` with pgvector embeddings
- Embedding generation in processing pipeline
- Similarity search filtered by `organization_id`
- `ai_message_sources` linking answers to chunks
- Citations displayed in UI

---

## Sprints 9–12 — Admin + hardening

- Admin dashboard: failed jobs, retry, usage by org, webhook failures
- Cost dashboard: per-org AI cost estimates
- Member invite flow (token, expiry, server-validated)
- Transactional emails via Resend
- Runbooks for Stripe webhook failures, queue backlog, AI provider outage

---

## Sprints 13–16 — Electron desktop

- Electron app shell (framework via ADR)
- Secure IPC (context isolation, no raw Node in renderer)
- Sign-in, org selection, local file upload
- Server-side entitlement check for desktop features
- Crash reporting + auto-update pipeline

---

## Sprints 17–19 — Real-time + collaboration

- SSE-based live document processing status
- Reconnect handling (restore latest DB state)
- Optional: presence, shared AI session view

---

## Sprints 20–24 — Performance + launch

- Query plan analysis + index tuning
- Entitlement cache (safe TTL)
- Load test report
- Landing page + onboarding funnel
- Launch metrics dashboard
- Public or private launch

---

## Lessons learned (apply to every sprint)

- **Run `pnpm verify` before every push** — lint + typecheck + test. A formatting error in `package.json` once broke CI after push; catching it locally is free.
- **Hand-written SQL migrations must be added to `meta/_journal.json`** — Drizzle's migrator only runs journal entries. SQL files without an entry are silently skipped, and tables will not be created.
