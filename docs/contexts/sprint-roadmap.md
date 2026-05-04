# Sprint Roadmap

> Phase overview and current status. Full task lists for each sprint: `docs/product/sprint-plan.md`

---

## Phase overview

```
Sprint 0         — Project setup                    ✅ Done
Sprint 1–2       — Auth + tenant boundary           🔄 In progress
Sprint 3–4       — Plans, entitlements, billing     Upcoming
Sprint 5–6       — Observability + file storage     Upcoming
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
- **Day 18**: `OrgLayout` threads real org data to sidebar; `OrganizationSwitcher` uses live orgs (not mock); dashboard shows real org name + getting-started checklist
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

- `plans`, `plan_limits` tables
- `packages/entitlements`: `getEntitlement(orgId)` → plan limits
- Entitlement checks wired to AI and upload endpoints

---

## Sprint 4 — Stripe Checkout, subscriptions, webhook idempotency

**Outcome:** User can upgrade to Pro; webhook updates app state idempotently.

- `billing_customers`, `subscriptions`, `stripe_events` tables
- Stripe Checkout session creation
- Webhook handler (verify signature, idempotent on `stripe_event_id`)
- Billing portal link for paid orgs

---

## Sprint 5 — Observability, analytics, feature flags

**Outcome:** Frontend + backend errors in Sentry; activation funnel in PostHog.

- Sentry: Next.js SDK, source maps, error boundary, API instrumentation
- PostHog: client + server event capture, core events
- One feature flag (e.g. `rag_v1_enabled`)

---

## Sprint 6 — File storage + document upload MVP

**Outcome:** User can upload a document; it appears with status `queued`.

- `storage_objects`, `documents` tables
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
