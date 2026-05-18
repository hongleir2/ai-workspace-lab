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
| `billing_customers` | 0007 | `id`, `organization_id` → organizations (ON DELETE CASCADE), `stripe_customer_id` (UNIQUE), `created_at` |
| `stripe_events` | 0007 | `id`, `stripe_event_id` (UNIQUE), `event_type`, `processing_status` CHECK (`received\|processing\|processed\|failed`), `error_message`, `received_at`, `processed_at`; idempotency gate for webhook handler (see ADR 0008) |
| `storage_objects` | 0009 | `id`, `organization_id`, `bucket`, `object_key`; UNIQUE(bucket, object_key); `original_filename`, `content_type`, `byte_size` (bigint, CHECK ≥ 0), `checksum_sha256`, `uploaded_by_user_id`, `status` enum (uploaded/deleted/quarantined), `created_at`, `deleted_at` |
| `documents` | 0010 | `id`, `organization_id`, `storage_object_id` → storage_objects, `created_by_user_id`, `title`, `source_type` enum (web_upload/desktop_upload/api/url), `file_type` (text), `status` enum (uploaded→queued→processing→chunking→embedding→indexed→ready/failed/deleted), `processing_error_code`, `processing_error_message`, `page_count`, `language`, `checksum_sha256`, `ready_at`, `created_at`, `updated_at` (trigger), `deleted_at` |
| `prompt_versions` | 0014 | `id`, `name`, `version`, `prompt_template`, `default_model_provider` (nullable), `default_model_name` (nullable), `is_active`, `created_by_user_id` (nullable), `created_at`; UNIQUE(name, version); seeded with `document_qa` v1 and `general_chat` v1 |
| `ai_sessions` | 0014 + 0015 | `id`, `organization_id`, `created_by_user_id`, `prompt_version_id` (nullable), `title`, `visibility` enum (`private`/`organization`/`shared`), `status` enum (`active`/`archived`/`deleted`), `created_at`, `updated_at` (trigger), `deleted_at`; UNIQUE(`id`, `organization_id`) supports tenant-safe message FKs |
| `ai_messages` | 0014 + 0015 | `id`, `organization_id`, `session_id`, `parent_message_id` (nullable), `created_by_user_id` (nullable), `role` enum (`user`/`assistant`/`system`/`tool`), `content`, `status` enum (`streaming`/`completed`/`failed`/`canceled`), `model_provider`, `model_name`, `input_tokens`, `output_tokens`, `total_tokens`, `cost_micro_usd`, `error_code`, `error_message`, `created_at`, `completed_at`; composite FKs enforce session/org match and same-session parent messages; indexes on org/session/created_at and model lookup |
| `rate_limit_events` | 0014 optional + 0015 | `id`, `organization_id` (nullable), `user_id` (nullable), `endpoint`, `limit_key`, `action` enum (`allowed`/`blocked`), `tokens_consumed`, `metadata`, `created_at`; debugging log for rate-limit decisions |
| `jobs` | 0011 | `id`, `organization_id`, `created_by_user_id`, `job_type`, `status` enum (`pending/processing/retrying/completed/failed/dead_lettered/canceled`), `payload` (jsonb), `idempotency_key` (UNIQUE), `attempts_count`, `max_attempts`, `run_after`, `locked_by`, `locked_at`, `last_error_code`, `last_error_message`, `completed_at`, `failed_at`, `dead_lettered_at`, `created_at`, `updated_at` (trigger) |
| `job_attempts` | 0012 | `id`, `job_id` → jobs, `attempt_number`; UNIQUE(job_id, attempt_number); `status` enum (`started/succeeded/failed/timed_out`), `error_code`, `error_message`, `metadata` (jsonb), `started_at`, `ended_at` |
| `document_chunks` | 0013 + 0016 | `id`, `organization_id`, `document_id` → documents; UNIQUE(document_id, chunk_index); `chunk_index`, `text`, `token_count`, `chunking_strategy` (0016), `start_char_index` (0016), `end_char_index` (0016), `page_start`, `page_end`, `section_title`, `embedding` (vector 1536), `embedding_model`, `metadata` (jsonb), `created_at` |

### Server packages using these tables

| Package | Tables | Role |
|---------|--------|------|
| `@ai-workspace-lab/entitlements` | `plans`, `plan_limits`, `subscriptions`, `usage_counters` (read) | Plan limits and quota checks (`fetchUsedCount` matches counter period to billing period) |
| `@ai-workspace-lab/usage` | `usage_events` (insert), `usage_counters` (upsert) | `recordUsageEvent` + `incrementUsageCounter`; `recordUsageWithCounter` in one transaction — counter periods must align with entitlements’ `getCurrentBillingPeriod` for the same org/feature |

---

## Upcoming tables (Sprint 6+)

| Table | Purpose |
|-------|---------|
| `ai_message_sources` | Citation links from AI answers to document chunks |
| `ai_feedback` | User feedback on AI messages |

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
storage_objects(bucket, object_key)  -- UNIQUE
storage_objects(organization_id, created_at)
storage_objects(checksum_sha256)
documents(organization_id, status)
documents(organization_id, created_at)
documents(created_by_user_id, created_at)
documents(checksum_sha256)
document_chunks(organization_id, document_id)
ai_sessions(organization_id, created_at)
ai_sessions(created_by_user_id, created_at)
ai_sessions(organization_id, status)
ai_messages(organization_id, session_id, created_at)
ai_messages(session_id, created_at)
ai_messages(organization_id, created_at)
ai_messages(model_provider, model_name)
rate_limit_events(organization_id, created_at)
rate_limit_events(user_id, created_at)
rate_limit_events(endpoint, created_at)
rate_limit_events(action, created_at)
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
- `prompt_versions` is global reference data and is readable by authenticated users.
- `audit_logs`: SELECT for org members; no UPDATE policy (append-only).
- `organizations_select_member` policy is defined in migration 0003 (after `organization_memberships` exists) to avoid FK circular dependency at policy-creation time.

---

## Migration rules

1. Forward-only — never edit a shipped migration; write a new one.
2. **Hand-written SQL files must be registered in `packages/db/migrations/meta/_journal.json`** — Drizzle's migrator only runs entries listed in the journal. SQL files without a journal entry are silently skipped.
3. Use `drizzle-kit generate` to auto-maintain the journal; if writing SQL manually, add the entry yourself.
4. Every new table needs an ERD entry and at least one integration test against a real Postgres.
5. RLS policies ship with the table in the same migration.
