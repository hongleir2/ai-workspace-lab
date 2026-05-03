# 0003 — Modular monolith first

## Status

Accepted — 2026-05-02

## Context

The product is a multi-tenant AI Workspace SaaS: web app, document processing, vector search, AI Q&A, billing, and a desktop companion. Plenty of teams reach for microservices at this point — separate ingest service, separate AI service, separate billing service.

For us, that would be premature. The team is small, the workload is bursty, and the dominant cost (AI provider calls) is not bottlenecked by deployment shape. Microservices would multiply our deploy targets, complicate local dev, and turn every cross-cutting feature into a coordination problem.

We have already locked the stack ([ADR 0001](./0001-stack-choice.md)) and the repo structure ([ADR 0002](./0002-repo-structure.md)). This ADR fixes the *runtime shape*: a single deployable Next.js app backed by a single Postgres, with background work executed in the same deployment via QStash.

This is the *modular* part: package boundaries inside the repo are real. We get the architectural benefits of clean seams without paying the operational tax of N services.

## Decision

We build a **modular monolith**:

- One Next.js deployment serves the web app, the API routes, and the AI/RAG endpoints.
- One Supabase Postgres holds all data, organization-scoped via `organization_id` (see [`docs/product/implementation-principles.md` §3](../product/implementation-principles.md#3-organization_id-everywhere)).
- Background work (document processing, embeddings, retries, scheduled jobs) runs via **QStash** hitting the same deployment's HTTP endpoints. No separate worker service.
- Internal package boundaries (`packages/auth`, `packages/billing`, `packages/entitlements`, `packages/ai`, `packages/jobs`, etc.) are the seams. Cross-package imports go through `index.ts` only.
- A new long-running process, a new deploy target, or a new datastore is **ADR-worthy**. Default answer to "should this be its own service?" is no.

## Alternatives considered

- **Microservices from day one** — clean diagram, real cost. Doubles deploy surface, complicates local dev, multiplies failure modes. We have no scale problem that justifies it yet.
- **Separate worker service for background jobs** — defensible, but QStash + same-deployment handlers gives us nearly all the benefit with none of the extra service. We re-evaluate when one job class needs a different runtime (e.g., GPU, large memory).
- **Lambda-per-feature** — fine-grained scale-to-zero is attractive, but Vercel's Next.js runtime already does this for us at the route level. Going further is premature.
- **Monolith with no package boundaries** — simplest, but trust-bearing code (entitlements, billing) blends with feature code and rots fast. The "modular" qualifier is what protects us from that.

## Consequences

- **What gets easier:** one deploy, one log stream, one set of secrets, one local dev command. Cross-cutting features land in one PR. Refactors that change a package's contract are catchable at type-check time.
- **What gets harder:** a runaway endpoint can degrade the whole app. We need real per-route rate limiting and per-org quota enforcement (already required by [`implementation-principles.md` §7](../product/implementation-principles.md#7-quota-before-ai-provider-call)). Long-running synchronous work is forbidden — anything >1s goes on a queue.
- **Trade-offs we accept:** memory and CPU are shared across feature areas. If one feature genuinely needs isolation (e.g., heavy embedding workloads), we revisit with a new ADR rather than retrofitting silently.

## Follow-up work

- [ ] Document the "no synchronous work >1s" rule in `CLAUDE.md` (currently implicit in engineering rule 4).
- [ ] Implement a per-route rate limit primitive in `packages/jobs` or a new `packages/ratelimit` (open question — is rate limit a job concern or its own package?).
- [ ] Revisit this ADR when any of the following triggers fire: (a) document processing latency requires a GPU worker, (b) AI traffic exceeds Vercel function timeout limits in steady state, (c) we onboard a customer whose data residency requires regional isolation.
