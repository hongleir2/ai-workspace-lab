# Open questions

Tracking unresolved product and architecture questions for `ai-workspace-lab`. Each entry should describe the question, what we've ruled out, who/what would unblock a decision, and the deadline-or-trigger that forces resolution. **Resolve into an ADR** (`docs/adr/`) when a decision is made — do not let answers live only in chat or commits.

> **Lifecycle.** A question moves from *Open* → *In progress* → *Resolved*. When resolved, link the ADR or PR that closed it and (optionally) leave a one-line summary here as a breadcrumb. Stale or no-longer-relevant questions are deleted, not archived.

---

## How to add a question

```md
### Q-NN — short title

**Status:** Open | In progress | Resolved (→ ADR-XXXX)
**Owner:** who is driving the decision
**Resolve by:** date or trigger ("before sprint 4", "before first paid customer")

**Question.** One paragraph. What are we deciding?

**Constraints / what we've ruled out.** What does the answer have to satisfy? What have we already considered and rejected, and why?

**Options on the table.**
1. …
2. …

**Unblocker.** What information, experiment, or stakeholder input would let us decide?
```

---

## Open

### Q-01 — Desktop framework choice

**Status:** Open
**Owner:** —
**Resolve by:** before sprint 15 (first desktop screen)

**Question.** Which framework does the desktop companion use — Electron, Tauri, or something else?

**Constraints / what we've ruled out.**
- Must support macOS and Windows in MVP; Linux is nice-to-have.
- Renderer must not have raw Node access (see [`implementation-principles.md` §8](./implementation-principles.md#8-electron-client-is-not-trusted)).
- Must support code-signed auto-update.
- Bundle size and memory footprint matter but are not load-bearing.

**Options on the table.**
1. **Electron** — proven, large ecosystem, heavier footprint.
2. **Tauri** — smaller binary, Rust core, smaller ecosystem and fewer native integrations.
3. **Native per-platform** — best UX, highest cost; almost certainly out of scope.

**Unblocker.** A small spike implementing the *Sign-in → Org selector → Upload* flow in each candidate, measuring binary size, cold-start time, and IPC ergonomics.

---

### Q-02 — Free vs. Pro plan limits

**Status:** Open
**Owner:** —
**Resolve by:** before sprint 4 (`/pricing` page ships)

**Question.** What are the hard quotas on Free? What's the price + quotas on Pro?

**Constraints / what we've ruled out.**
- Free must be useful enough to demonstrate the value prop within 5 minutes of signup.
- Free must not be cheap-to-abuse for AI cost (see [`implementation-principles.md` §7](./implementation-principles.md#7-quota-before-ai-provider-call)).
- Pro pricing must clear blended AI cost per active org with margin for storage, support, and churn.

**Options on the table.**
- TBD — needs a cost-model spreadsheet derived from observed token usage in alpha.

**Unblocker.** Cost dashboard from sprints 8–10 (real AI usage from internal use) + a small competitive scan.

---

### Q-03 — Vector store: pgvector vs. dedicated index

**Status:** Open
**Owner:** —
**Resolve by:** before the first paying customer's corpus exceeds ~50k chunks

**Question.** Do we keep RAG embeddings in `pgvector` (current ADR 0001 default) or migrate to a dedicated vector DB (Pinecone, Qdrant, Turbopuffer, etc.) at scale?

**Constraints / what we've ruled out.**
- We have already locked `pgvector` as the default for MVP — see [ADR 0001](../adr/0001-stack-choice.md).
- Switching requires a new ADR and a migration plan.

**Options on the table.**
1. Stay on `pgvector`; tune indexing (`ivfflat` / `hnsw`) and shard by org if needed.
2. Move hot paths only (similarity search) to a dedicated vector DB; keep metadata in Postgres.
3. Full migration to a dedicated vector DB.

**Unblocker.** Latency and recall measurements at 100k / 1M / 10M chunks against `pgvector`'s best configuration.

---

### Q-04 — Multi-tenant boundary for AI prompts and outputs

**Status:** Open
**Owner:** —
**Resolve by:** before sprint 8 (first AI message ships)

**Question.** Beyond the existing `organization_id` filter on `document_chunks`, do we need additional defense (per-org prompt isolation, separate provider keys, or per-org embedding namespaces) to prevent cross-org leakage in retrieval or output?

**Constraints / what we've ruled out.**
- Per-org provider keys are operationally expensive and almost certainly overkill for MVP.
- The `organization_id` predicate in retrieval is the load-bearing gate (see [`implementation-principles.md` §3](./implementation-principles.md#3-organization_id-everywhere)).

**Options on the table.**
1. Trust the predicate + add a runtime assertion that every retrieved chunk's `organization_id` matches before passing to the model.
2. Additionally namespace embeddings by `organization_id` in the index (e.g., separate `pgvector` partition).
3. Runtime model-output redaction (overkill, almost certainly the wrong tool).

**Unblocker.** A red-team test: try to retrieve another org's chunks via crafted prompt and via direct query manipulation.

---

### Q-05 — Audit log retention

**Status:** Open
**Owner:** —
**Resolve by:** before sprint 11 (audit log feature)

**Question.** How long do we retain `audit_logs`? Per-plan or universal?

**Constraints / what we've ruled out.**
- Storage cost is small; legal exposure is the real constraint.
- Some compliance regimes (SOC 2, future ISO 27001) prescribe minimums.

**Options on the table.**
1. 90 days universal.
2. 90 days Free, 1 year Pro, configurable Enterprise.
3. Forever, archived to cheap object storage after 90 days.

**Unblocker.** Confirm legal/compliance posture for v1 launch.

---

### Q-07 — OAuth provider rollout (Google, Apple)

**Status:** Open
**Owner:** —
**Resolve by:** before sprint 6 (or earlier if signup friction shows up in alpha telemetry)

**Question.** Which OAuth providers do we add after email/password, in what order, and do any of them require provider-specific UX (Apple's "hide my email" relay, Google Workspace org-restriction, etc.) that the current schema can't model?

**Constraints / what we've ruled out.**
- The composite-key `users` table from [ADR 0005](../adr/0005-authentication-model.md) (`auth_provider`, `auth_provider_user_id`) supports new providers without schema migration; this question is about UX and account-linking, not data shape.
- Apple's relay email (`@privaterelay.appleid.com`) interacts with our `email` unique index — same human, two providers, two different emails on file.
- Account linking (one human, multiple providers, same `users` row) is out of scope for MVP unless the unblocker says otherwise.

**Options on the table.**
1. **Google first, Apple later.** Lowest friction for the alpha audience; defer Apple's relay-email complexity.
2. **Google + Apple together.** Required if we ever ship a desktop or iOS surface that uses Sign-in-with-Apple (Apple's review guidelines mandate Apple as an option if any other social provider is offered).
3. **No OAuth in MVP.** Email/password only until paid customers exist.

**Unblocker.** Alpha signup-funnel data (does email/password drop-off justify the work?) + decision on whether the desktop companion uses Sign-in-with-Apple.

---

### Q-08 — Deleted-user re-signup with the same email

**Status:** Open
**Owner:** —
**Resolve by:** when a real customer asks (no internal forcing function)

**Question.** Should a user who has been soft-deleted (`status='deleted'`, tombstone row preserved) be able to sign up again with the same email and start fresh?

**Constraints / what we've ruled out.**
- [ADR 0005](../adr/0005-authentication-model.md) accepts as MVP behavior that the `users.email` unique index blocks re-signup until a tombstone is purged.
- We are NOT willing to relax the email unique index; orphaning historical FKs is worse than blocking re-signup.
- Supabase Auth side: the `auth.users` row is also kept by default — purging it is a separate admin action.

**Options on the table.**
1. Build an admin "purge tombstone" SQL operation; instruct support to run it on request.
2. Build a self-serve "request account purge" UI tied to support flow.
3. Keep MVP behavior; document publicly that account deletion is permanent for the same email.

**Unblocker.** First customer support request that actually asks for it. Until then, option (3) is the documented stance.

---

### Q-09 — Auth-layer ban vs. application-layer disable

**Status:** Open
**Owner:** —
**Resolve by:** before the first abuse incident that requires immediate session revocation

**Question.** When we disable a user, should we *also* revoke their Supabase Auth session (via Supabase admin API or `banned_until`), or is the application-layer `users.status='disabled'` redirect sufficient?

**Constraints / what we've ruled out.**
- [ADR 0005](../adr/0005-authentication-model.md) chose application-layer-only enforcement for MVP, accepting that "a bug in the helper would let a disabled user reach a protected route."
- The application layer is the only place we can currently distinguish disabled-but-readable from deleted; the auth layer can only emit "you are banned."
- Hybrid models (banned in Supabase + deleted in app) were rejected as harder to reason about.

**Options on the table.**
1. Stay application-layer-only. Add a Playwright regression that proves the disabled-account redirect works.
2. Add an admin "ban" action that calls Supabase's admin API to revoke sessions in addition to setting `users.status='disabled'`.
3. Move enforcement entirely to Supabase Auth's `banned_until`, accept the loss of "deleted as a separate state."

**Unblocker.** First abuse incident or compliance ask that demands "kill this user's active session in < 1 minute." Until then, the cheap regression test (option 1's prerequisite) is enough.

---

### Q-06 — Email deliverability and domain reputation

**Status:** Open
**Owner:** —
**Resolve by:** before sprint 12 (invites + transactional email)

**Question.** Single sending domain or split (transactional vs. marketing)? SPF/DKIM/DMARC posture?

**Constraints / what we've ruled out.**
- Resend is the locked provider (ADR 0001).
- Mixing transactional and marketing email on one domain is a known deliverability footgun.

**Unblocker.** DNS plan + decision on whether the marketing site even sends bulk email in v1.

---

## Resolved

*(none yet — once a question is closed, move it here with a link to the ADR or PR that closed it, then prune older entries when they stop being useful as context)*
