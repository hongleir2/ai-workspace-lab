# Implementation principles

Non-negotiable invariants for every implementation in `ai-workspace-lab`. If a change appears to violate one of these principles, **stop and write an ADR** explaining why before proceeding. These exist because each one, when violated, has produced a real-money or real-trust incident in similar systems.

> **Reading order.** This file is the *how we build it* contract. Pair it with [`prd.md`](./prd.md) (the *what*), [`erd.md`](./erd.md) (the *data shape*), [`frontend-page-map.md`](./frontend-page-map.md) (the *routes*), and [`../../CLAUDE.md`](../../CLAUDE.md) (the *operating contract for AI agents*).

---

## 1. Modular monolith first

Build a single deployable Next.js app backed by a single Postgres. Use the `packages/` boundaries to keep responsibilities cleanly separated, but **do not split into microservices** for the SaaS until there is a measured reason that an ADR documents.

**Why.** Microservices premature-optimize for org scale at the cost of feature velocity, debug surface, and consistency. A modular monolith with strict package boundaries gets the architectural benefits (clear seams, replaceable pieces) without the operational cost.

**Apply.**
- Cross-package imports go through the package's public `index.ts` only.
- A package may not reach into another package's internals.
- Background work runs in the same deployment via QStash; it is *not* a separate service.
- A new long-running process is an ADR-worthy decision.

---

## 2. Server owns trust

Every authentication, authorization, entitlement, and quota check happens **server-side**. The client gets answers from the server; it does not compute trust on its own. This applies equally to the web app, the desktop companion, and any future API consumer.

**Why.** A client check is a UX hint, not a security gate. Anything attackable, edit-able, or replayable on the client *will* be. Customers paying for "Pro" features must not be unlockable by toggling a local flag.

**Apply.**
- Every Server Component, Route Handler, and Server Action validates the session, the org membership, and the entitlement *before* doing work.
- Client-side checks may show or hide UI but must never be the only gate.
- Desktop renderers call the server for entitlements; cached values are UX optimization only.
- "Just trust the JWT claim" is not enough — re-resolve org membership server-side per request.

---

## 3. `organization_id` everywhere

Every row that belongs to an organization carries `organization_id`, and every read and every write filters by it. This is the load-bearing invariant for multi-tenant correctness.

**Why.** A missing `organization_id` predicate is how data leaks between tenants. Once it has happened, the trust damage is unrecoverable.

**Apply.**
- Every org-scoped table has a `NOT NULL organization_id` column with a foreign key.
- Every query path that reads an org-scoped table filters by `organization_id`.
- Every write path stamps `organization_id` from the *server-resolved* org context, not from the client request body.
- RLS is enabled on every org-scoped table — but it is the *second* gate, not the first. The app code is the first gate.
- AI retrieval re-checks each `document_chunks` row's `organization_id` before passing the chunk to the model.
- Cross-org joins (e.g., a collection containing documents) assert the same `organization_id` on both sides before write.

**A query plan without the `organization_id` predicate is a bug.**

---

## 4. Webhook idempotency

Every webhook handler — Stripe, QStash, Resend events, and any future provider — is idempotent. Receiving the same event twice produces the same end state, never duplicate side effects.

**Why.** Providers retry. Networks drop ACKs. A non-idempotent webhook handler that runs twice can charge twice, provision twice, or send two emails. With Stripe specifically, the cost is real money.

**Apply.**
- Verify the provider signature *before* doing any work. No signature, no work.
- Persist a row keyed by `(provider, event_id)` (e.g., `stripe_events.id`) before applying side effects. If the row already exists, return success without re-applying.
- Side effects either complete inside one transaction with the event-row insert, or are themselves keyed for idempotency.
- Test: handle the same event twice in a test and assert state changes exactly once.
- Never edit a processed event row — write a new compensating event if a fix is required.

---

## 5. Job idempotency

Every background job — document processing, embedding generation, email, retries — is idempotent. Running the same job twice produces the same end state.

**Why.** Queues retry. Workers crash mid-job. A non-idempotent retry can produce duplicate documents, duplicate embeddings, duplicate cost, or silent data corruption.

**Apply.**
- Each job carries a deterministic key (e.g., `document_id`, `(session_id, message_id)`) — never a one-shot UUID generated at enqueue time.
- The first action of every handler is to check whether the work has already been done (e.g., "is this document already `ready`?") and exit early if so.
- Writes inside a job either go through `INSERT … ON CONFLICT DO NOTHING / UPDATE`, or use a job-scoped transaction that succeeds at most once.
- Cost-incurring side effects (AI provider calls, paid storage operations) are guarded by an "already done?" check.
- Test: run the same job handler twice and assert state and cost change exactly once.

---

## 6. Usage idempotency

Every usage event written for billing, quotas, and observability is idempotent. The same logical action recorded twice produces one usage row, not two.

**Why.** Usage feeds quotas, billing, and reporting. Double-counted usage falsely throttles paying customers and falsely inflates cost dashboards. Under-counting under-bills. Both are bugs that surface as customer trust incidents.

**Apply.**
- `usage_events` rows carry a stable idempotency key (e.g., `(organization_id, action, resource_id)` or `(organization_id, action, request_id)`).
- `INSERT … ON CONFLICT (idempotency_key) DO NOTHING` is the standard write pattern.
- Aggregations into `usage_counters` are derived from `usage_events` and are themselves idempotent — re-aggregating must not double-count.
- A retried request must not produce a second usage row for the same logical action.
- Test: emit the same event twice and assert exactly one row and one quota increment.

---

## 7. Quota before AI provider call

Every call to an AI provider passes a strict gate **before** the provider request goes out: entitlement → quota → rate limit. If any of the three fails, the provider is not called and the user gets a typed error.

**Why.** AI is the most expensive operation in the system per request. A missing gate turns a runaway loop, a credential leak, or an abusive client into a real bill. Even a single regression here can cost more in a day than the rest of the stack costs in a month.

**Apply (server-side, always, before any provider SDK call):**
1. `requireUser()` — session is valid.
2. `requireOrganization()` + `requireMembership()` — the user belongs to the org they claim.
3. `checkEntitlement("ai_messages")` — the org's plan includes this feature.
4. `checkQuota("ai_messages")` — the org has remaining quota for this billing period.
5. `checkRateLimit("/api/ai/chat")` — the request is under the per-user/per-org rate limit.
6. `resolveRagScope()` — retrieved `document_chunks` are verified to belong to this organization.
7. **Then** call the provider.
8. After the call, write a `usage_events` row keyed for idempotency (see §6) — even if the call failed partway.

**Failure handling.**
- If the provider call fails mid-stream, the usage event still records what was consumed (the provider charges for partial completions).
- Quota-exceeded responses return a typed error the client can surface as an upgrade prompt — not a generic 500.

---

## 8. Electron client is not trusted

The desktop companion is a UI surface, not a privileged actor. Treat its renderer process the same way you treat a browser tab: untrusted input, no direct access to secrets, no authority to grant itself entitlements.

**Why.** A user's machine can be modified, debugged, and replayed against. A "desktop client" is not a security boundary. The local entitlement cache exists for UX continuity, not for trust.

**Apply.**
- Renderer processes do **not** access raw Node APIs. Use a typed, validated IPC bridge.
- Every IPC message is validated server-side (in the main process and, where it leaves the device, on the API).
- Paid desktop features call the server entitlement endpoint. Local cache is a hint only — when in doubt, re-check.
- A reachable server is required to *grant* entitlements; offline grace is bounded and itself server-issued (with a server-set expiry).
- Auto-update channels and signed update artifacts are mandatory; never ship an unsigned binary.
- Telemetry, crash reports, and update checks must not exfiltrate document content or secrets.

---

## Cross-cutting checklist

Before any feature PR is "done," confirm:

- [ ] No org-scoped query without `organization_id`.
- [ ] No protected route without server-side auth check.
- [ ] No AI provider call without entitlement + quota + rate limit check first.
- [ ] No webhook handler without signature verification + idempotency key persistence.
- [ ] No background job without a deterministic idempotency key.
- [ ] No usage write without an idempotency key.
- [ ] No new microservice (or out-of-process worker that isn't QStash) without an ADR.
- [ ] No desktop feature that grants itself trust without a server check.

If any box is unchecked, the PR is not ready.
