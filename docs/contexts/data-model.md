# Data Model Summary

> Condensed from `docs/product/erd.md`. For full column specs, read the ERD directly.

---

## Design principles

- Every business resource is **organization-scoped** (`organization_id NOT NULL`). See [ADR 0006](../adr/0006-multi-tenant-data-model.md) for the full tenancy model.
- Isolation is two-layer: app code filters by `organization_id` first; RLS is the safety net.
- Roles: `owner > admin > member`. Enforced via `requireRole()` server-side only.
- `users` is the app-level profile; Supabase Auth is the identity provider.
- **Billing is org-level**, not user-level. Subscription → org.
- Entitlements are **computed server-side** — never trust the client.
- Usage is **event-based**: immutable `usage_events` rows; optional `usage_counters` for fast reads.
- AI messages store provider, model, token counts, cost estimate, and citations.
- Document processing is **async**: upload creates a `documents` row + `jobs` row.

---

## Domain map

```
Identity & tenancy
  users, organizations, organization_memberships, invitations, audit_logs

Billing & entitlements
  plans, plan_limits, billing_customers, subscriptions, stripe_events, entitlement_checks

Documents & RAG
  storage_objects, documents, document_versions, document_collections,
  document_collection_items, document_chunks

AI conversations
  prompt_versions, ai_sessions, ai_messages, ai_message_sources, ai_feedback

Usage, quotas, cost
  usage_events, usage_counters, rate_limit_events

Async jobs
  jobs, job_attempts

Notifications
  notifications, email_events

Desktop companion
  desktop_installations, desktop_sessions, desktop_uploads

Real-time & collaboration
  realtime_rooms, room_participants
```

---

## Shipped tables (migrations applied)

| Table | Migration | Key columns |
|-------|-----------|-------------|
| `users` | 0000 | `id`, `auth_provider`, `auth_provider_user_id`, `email`, `status` |
| `organizations` | 0002 | `id`, `name`, `slug` (citext), `owner_user_id NOT NULL`, `status`, `metadata` |
| `organization_memberships` | 0003 | `id`, `organization_id`, `user_id`, `role` (enum), `status` (enum), `joined_at` |
| `audit_logs` | 0004 | `id`, `organization_id` (nullable), `actor_user_id` (nullable), `action`, `entity_type`, `entity_id`, `before_state`, `after_state`, `ip_address`, `user_agent` |
| `plans` | 0005 | `id` (text PK), `name`, `billing_interval` (enum), `price_cents`, `currency`, `is_active`, `sort_order` |
| `plan_limits` | 0005 | `id`, `plan_id` → plans, `feature_key`, `limit_value` (nullable = unlimited), `limit_unit`, `reset_interval`, `hard_limit` |
| `subscriptions` | 0005 | `id`, `organization_id` → organizations, `plan_id` → plans, `status` (enum), `seats`, period fields, Stripe fields; partial UNIQUE on active org |
| `usage_events` | 0005 | `id`, `organization_id`, `user_id`, `feature_key`, `event_type`, `quantity`, `unit` (enum), AI fields, `idempotency_key` (UNIQUE nullable) |
| `usage_counters` | 0005 | `id`, `organization_id`, `feature_key`, `period_start`, `period_end`, `used_quantity`, `limit_quantity`; UNIQUE on (org, feature, period) |

---

## Upcoming tables (Sprint 2+)

| Table | Purpose |
|-------|---------|
| `billing_customers` | Stripe customer ID per org (Sprint 4) |
| `stripe_events` | Webhook idempotency (unique on `stripe_event_id`) |
| `documents` | Upload metadata + processing status |
| `document_chunks` | Text chunks + pgvector embeddings |
| `ai_sessions` | Conversation container |
| `ai_messages` | User + assistant messages with token tracking |
| `jobs` | Async job status + retry state |

---

## Ownership rules

Every row in these tables **must** include `organization_id`:
```
documents, document_chunks, ai_sessions, ai_messages,
usage_events, jobs, audit_logs, subscriptions, invitations
```

Actor tracking via `user_id` in: `documents.created_by_user_id`, `ai_messages.created_by_user_id`, `usage_events.user_id`, `audit_logs.actor_user_id`

---

## Key indexes

```sql
organization_memberships(user_id, organization_id)
documents(organization_id, status)
documents(organization_id, created_at)
document_chunks(organization_id, document_id)
ai_sessions(organization_id, created_at)
usage_events(organization_id, created_at)
usage_events(organization_id, event_type, created_at)
jobs(status, run_after)
jobs(organization_id, status)
audit_logs(organization_id, created_at)
stripe_events(stripe_event_id)  -- UNIQUE
subscriptions(organization_id)  -- UNIQUE
```

---

## RLS model

- All tables enable RLS.
- **SELECT**: members can read their org's rows; `organization_memberships` is the gate.
- **INSERT/UPDATE**: service role only (no authenticated-role write policies). App writes go through the Supabase service role key.
- `audit_logs`: SELECT for org members; no UPDATE policy (append-only).
- `organizations_select_member` policy is defined in migration 0003 (after `organization_memberships` exists) to avoid FK circular dependency at policy-creation time.

---

## Migration rules

1. Forward-only — never edit a shipped migration; write a new one.
2. **Hand-written SQL files must be registered in `packages/db/migrations/meta/_journal.json`** — Drizzle's migrator only runs entries listed in the journal. SQL files without a journal entry are silently skipped.
3. Use `drizzle-kit generate` to auto-maintain the journal; if writing SQL manually, add the entry yourself.
4. Every new table needs an ERD entry and at least one integration test against a real Postgres.
5. RLS policies ship with the table in the same migration.
