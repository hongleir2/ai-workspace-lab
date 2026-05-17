# Product Overview

> Condensed from `docs/product/prd.md`. For full requirements tables and acceptance criteria, read the PRD directly.

---

## What we're building

**AI Workspace** — a paid multi-tenant SaaS where individuals and small teams upload documents, ask AI questions over their knowledge base, and get cited answers. Built as a modular monolith (not microservices). The project is also a structured learning capstone for production-grade SaaS architecture skills.

**Target users:** solo founders, small teams (2–5), power users on paid plan.

---

## The core product loop

```
Visitor lands
→ Sign up
→ Create organization
→ Upload document
→ Background processing (async)
→ Ask AI question
→ Receive answer with source citations
→ Hit usage quota
→ Upgrade to Pro
→ Continue
```

This loop is the definition of MVP success.

---

## Plans and limits (initial targets, adjust after launch)

| Feature | Free | Pro |
|---------|-----:|----:|
| AI messages | 10/day | 500/month |
| Document uploads | 3/day | 100/month |
| File size | 5 MB | 50 MB |
| Team members | 1 | 5 |
| Desktop companion | No | Yes |

---

## Feature areas and priority

### P0 — Must ship for MVP

| Area | What it does |
|------|-------------|
| **Auth** | Signup/signin via Supabase Auth; server-side session; protected routes |
| **Organizations** | Create org; org-scoped all resources; roles: owner/admin/member |
| **Permissions** | Server-side role checks; member can read, admin can invite, owner manages billing |
| **Billing** | Stripe Free + Pro plans; Checkout; idempotent webhooks; billing portal |
| **Entitlements** | Server-side plan/quota enforcement before every AI/upload call |
| **Document upload** | Upload PDF/txt/md; store in object storage; create DB row + async job |
| **Async processing** | Extract text → chunk → embed → index; retry on failure; visible status |
| **AI chat** | Streaming responses via Vercel AI SDK; quota + rate-limit check before model call |
| **RAG** | Retrieve relevant chunks by embedding similarity; org-filtered; citations in answer |
| **Usage tracking** | Record every AI request, token count, upload, quota hit as immutable events |
| **Rate limiting** | Per-user and per-org limits via Upstash Redis |
| **Observability** | Sentry (errors + traces); PostHog (activation funnel + events) |
| **Analytics events** | See event taxonomy in PRD §13 |

### P1 — Beta / post-MVP

| Area | What it adds |
|------|-------------|
| **Electron desktop** | Secure IPC; local file upload; server entitlement check; crash reporting |
| **Real-time status** | SSE-based live document processing status; reconnect handling |
| **Admin dashboard** | View failed jobs, retry, usage by org, webhook failures |
| **Transactional email** | Invite, document-ready, onboarding nudge via Resend |
| **Member invites** | Token-based invite flow; expiry; server-validated |
| **Cost dashboard** | Per-org AI cost estimates; admin view |

### P2 — Future

- Presence / shared AI sessions
- Full-text annotations and document comments
- Team plan (more seats, shared quotas)
- Performance hardening (indexes, load testing)
- Launch landing page + public launch

---

## Non-goals (do not build)

- Kubernetes or microservices
- Multi-region infrastructure
- Custom auth or billing engine
- Enterprise SSO
- Google Docs-style collaborative editing
- Mobile app

---

## Subscription states the app must handle

```
free | trialing | active | past_due | canceled | unpaid | incomplete | incomplete_expired
```

Paid features unlock via **server-side subscription state from Stripe webhook**, never from client redirect.

---

## Required analytics events (P0)

```
user_signed_up, organization_created, onboarding_started, onboarding_completed,
document_uploaded, document_processing_completed, document_processing_failed,
ai_chat_started, ai_chat_completed, ai_chat_failed,
quota_exceeded, checkout_started, subscription_started, subscription_canceled,
invite_sent, invite_accepted
```

---

## Architecture shape

```
Next.js Server Actions / API Routes
  → Auth + Authorization Layer
  → Domain Services (org, billing, entitlement, document, AI, usage, jobs)
  → Infrastructure (Postgres, Redis, R2, Stripe, AI provider, Resend, Sentry, PostHog)
```

All packages live in `packages/`; apps in `apps/`. See `CLAUDE.md §16` for folder map.

---

## Milestones

| # | Name | Status |
|---|------|--------|
| 0 | Project setup | ✅ Done |
| 1 | SaaS foundation (auth, orgs, memberships, audit logs) | 🔄 In progress |
| 2 | Billing + entitlements | Upcoming |
| 3 | Observability + analytics | Upcoming |
| 4 | AI chat MVP | In progress |
| 5 | Document processing + RAG | Upcoming |
| 6 | Admin operations | Upcoming |
| 7 | Electron companion | Future |
| 8 | Real-time status + collaboration | Future |
| 9 | Performance, caching, launch | Future |

---

## Key invariants (never violate)

1. Every org-scoped query must `WHERE organization_id = ?`.
2. AI calls must check entitlement + quota + rate limit **before** the provider call.
3. Stripe webhooks must verify signature and be idempotent.
4. Server-only secrets never reach the client bundle.
5. Every protected route has server-side auth checks — client-side is UX only.
6. RAG retrieval re-checks `organization_id` for every chunk before passing to model.
