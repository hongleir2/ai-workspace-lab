# 0001 — Stack lock-in

## Status

Accepted — 2026-05-02

## Context

`indie-lab` is a personal monorepo for shipping indie AI products. The first product (an AI Workspace SaaS) and every product after will land here. Stack-shopping is the single biggest indie-momentum killer: every "let me try Y instead of X" wipes a week.

This ADR fixes the **default stack** for any new app in this repo. Each layer is chosen on three criteria, in order:

1. **Managed first.** Don't run servers I can rent. Buy time, not infra.
2. **Production-shaped from day one.** Auth, payments, observability, rate limiting must all exist before launch.
3. **Reversible enough.** No layer is so locked-in that swapping it later is impossible — but the switch must be motivated by a real failure, not a thought experiment.

A switch requires a **new ADR** (`0002+`) that supersedes the relevant row.

## Decision

| Layer                         | Default                                                                                  | Switch only if…                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Framework**                 | Next.js 15 + App Router + RSC                                                            | A real serverless limit (request body size, edge runtime cap, streaming behavior) blocks a feature that has paying users. |
| **Database**                  | Supabase Postgres                                                                        | Pure Neon is needed for branching workflows on a project that does heavy schema iteration.                                |
| **Auth**                      | Supabase Auth (Phase 1) → Clerk (Phase 4 if orgs/RBAC UI eats more time than it teaches) | Org/team UI eats more time than learning to build it.                                                                     |
| **Payments**                  | Stripe Billing                                                                           | Never.                                                                                                                    |
| **Email**                     | Resend                                                                                   | Never.                                                                                                                    |
| **Errors / tracing**          | Sentry                                                                                   | Never.                                                                                                                    |
| **Analytics + feature flags** | PostHog                                                                                  | Never.                                                                                                                    |
| **Cache + rate limit**        | Upstash Redis                                                                            | Never.                                                                                                                    |
| **Object store**              | Cloudflare R2                                                                            | Lifecycle rules are needed from day one (then prefer S3).                                                                 |
| **AI SDK**                    | Vercel AI SDK + Anthropic Claude                                                         | A required model is not on the AI SDK.                                                                                    |
| **Vector**                    | Postgres `pgvector`                                                                      | Crossing ~1M vectors → Pinecone.                                                                                          |

### Per-layer rationale

**Next.js 15 + App Router + RSC.** Server Components and Server Actions collapse the typical `Express + REST + React` boilerplate into a single typed boundary. Vercel hosting is the easiest production deploy. The "real limit" trigger means I do not preemptively split into a separate API server; if/when streaming or request shape forces it, I add a backing service.

**Supabase Postgres.** I get Postgres + RLS + Storage + Auth in one console with one connection model. Migrations live in the repo. Neon's branching is appealing but only matters if I'm doing schema-heavy work; I'm not — I'm shipping product.

**Supabase Auth → maybe Clerk.** Supabase Auth is "good enough" and avoids one external dependency. Clerk's value is the **prebuilt org/team/RBAC UI**. The honest test in Phase 4: if I am still hand-rolling org-switcher / invite-acceptance / RBAC screens at month four, I have lost the trade. Until then, Supabase Auth.

**Stripe.** Custom billing is the indie equivalent of writing your own database. Never.

**Resend.** Cheapest correct path to transactional email; the API is a `fetch` call.

**Sentry.** Errors + traces in one place, source maps work, alerts route to whatever I want. Building this from logs is a tax I will not pay.

**PostHog.** Product analytics + feature flags + session replay + funnels in one tool, self-hostable later if cost demands. Splitting these to a separate analytics + flag vendor is premature.

**Upstash Redis.** Serverless-friendly Redis with HTTP API; needed the moment I add a real rate limit. Building rate limiting on the database is a known antipattern at any scale.

**Cloudflare R2.** S3-compatible, no egress fees. Supabase Storage is fine for MVP, but R2 wins as soon as I'm serving large files to the public web. Lifecycle rules are the one feature where S3 still wins.

**Vercel AI SDK + Anthropic Claude.** AI SDK gives a unified streaming interface, tool calls, and provider-agnostic primitives. Claude is the default model; switching providers is one constructor call. The "model not on AI SDK" exception is rare and usually short-lived.

**Postgres `pgvector`.** Same database, no extra service, vector search is a single `<->` operator away. The cross-over to Pinecone is at a scale (>1M vectors) I should be excited to hit.

## Consequences

**Accepted trade-offs**

- Vendor concentration on Supabase + Stripe. Both are reversible with effort; neither is irreversible.
- Vercel-shaped runtime constraints (request body, streaming). The "real limit" rule keeps me honest.
- Clerk migration debt is real if I switch in Phase 4. ADR will cover the migration if/when it happens.
- pgvector recall and latency at very high scale. Mitigation: log retrieval quality + p95 latency from day one so the trigger is data-driven.

**Follow-up work**

- ADR 0002 — Authentication model (Supabase Auth integration, session model, what is trusted server-side).
- ADR 0003 — Multi-tenant data model (org-scoped ownership, RLS or app-level enforcement).
- Set up the actual accounts (Supabase, Stripe test, Resend, Sentry, PostHog, Upstash, Cloudflare) — tracked separately.
- Add a `packages/db` workspace once the first migration ships.

**What we monitor**

- Vercel function size and runtime budgets.
- Supabase row counts and connection pool saturation.
- Sentry error budget for the AI endpoint.
- pgvector recall on a fixed eval set as the corpus grows.
- Time spent on org/team UI — the Clerk trigger.
