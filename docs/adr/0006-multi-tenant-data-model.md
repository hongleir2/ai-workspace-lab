# 0006 — Multi-Tenant Data Model

## Status

Accepted

## Context

`ai-workspace-lab` is an organization-scoped SaaS product. Every user belongs to one or more organizations, and all domain data (documents, AI sessions, audit logs, billing records) belongs to exactly one organization. The core isolation requirement is that a user authenticated as a member of organization A must never be able to read or write data that belongs to organization B — even if both organizations exist in the same Postgres database.

We need a durable, auditable answer to three questions:

1. **How is every row tied to its organization?**
2. **What prevents cross-organization data access?**
3. **How are user permissions within an organization modeled?**

## Decision

### 1. `organization_id` on every org-scoped table

Every table that holds organization-scoped data carries a `NOT NULL` foreign key `organization_id` that references `organizations.id`. This column is always present in `WHERE` clauses and is indexed. There are no implicit "tenant by row owner" patterns — the tenant boundary is always explicit.

Platform-level tables (`users`, `audit_logs` for platform events) may omit or null-allow `organization_id` when the row has no tenant context.

### 2. Two-layer isolation: app filter + RLS safety net

**Layer 1 — application filter (primary gate):** Every Drizzle query that touches an org-scoped table includes an explicit `eq(table.organizationId, ctx.organizationId)` predicate. The service layer enforces this. No query plan reaches Postgres without the predicate.

**Layer 2 — Row-Level Security (secondary gate):** Every org-scoped table enables RLS. Policies allow authenticated users to `SELECT` only rows where there is an active membership record for their `auth.uid()` in `organization_memberships`. All `INSERT`, `UPDATE`, and `DELETE` operations go through the service role (server-side only); no direct authenticated writes are permitted.

RLS is intentionally redundant with the application filter. Its purpose is to limit blast radius if the app layer fails to include the predicate. It is not a substitute for correct application code.

### 3. Three-role membership model

```
owner   — full control: settings, members, billing, delete org
admin   — manage members, most settings; cannot delete org or manage billing
member  — read-only access to workspace; cannot change settings or membership
```

Roles are stored in `organization_memberships.role` as an enum. Authorization checks use `requireRole(orgSlug, allowedRoles)` server-side — never client-side.

Membership also carries a `status` field: `active`, `invited`, `suspended`, `removed`. Guards check `status = 'active'` before granting access. Invited or suspended users cannot access the workspace even if a membership row exists.

### 4. Append-only audit log

Every mutation to an org-scoped entity writes a row to `audit_logs` with:
- `organization_id` — the tenant boundary
- `actor_user_id` — who performed the action (null for system events)
- `action` — dotted verb: `organization.created`, `membership.invited`, etc.
- `entity_type` / `entity_id` — what was changed
- `before_state` / `after_state` — JSONB snapshots

`audit_logs` has no `updated_at` column and no `UPDATE` or `DELETE` policies. Rows are never modified after insert.

### 5. AI retrieval re-verification

When pulling `document_chunks` for a RAG prompt, every retrieved chunk is re-checked against `organization_id` before being passed to the model. A chunk that passes the initial similarity search but fails the org check is silently dropped — never surfaced to the wrong tenant.

## Consequences

**Must-do:**
- Every new org-scoped table migration must include `organization_id NOT NULL`, an index on that column, and RLS policies in the same migration file.
- Every Drizzle query against an org-scoped table must include `eq(table.organizationId, ...)`. Any query that reaches Postgres without this predicate is a bug.
- Every new trust-boundary function (auth, entitlement, quota, membership check) must have an integration test against a real Postgres instance.
- `requireRole` is the single authoritative check for route authorization. No ad-hoc `if membership.role === 'owner'` checks in page code.

**Trade-offs accepted:**
- Single-database tenancy means a noisy neighbor can affect query performance. Addressed at Sprint 22 with query plan analysis and index tuning.
- RLS adds query planning overhead for every request. Acceptable at current scale; revisit if p99 latency degrades.
- Audit log grows indefinitely. Archival / partitioning is future work (Sprint 14+).

**Follow-up work:**
- Entitlement and quota checks (Sprint 3) will layer on top of this model.
- AI chunk re-verification (Sprint 9) must follow the rule in §5.
- Admin tooling (Sprint 11) needs a `requirePlatformAdmin()` guard separate from org-level roles.
