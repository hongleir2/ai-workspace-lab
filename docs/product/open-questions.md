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
