This ERD is based on the earlier PRD and roadmap: a multi-tenant AI SaaS with organizations, roles, Stripe subscriptions, entitlements, document upload, async processing, RAG, AI chat, usage quotas, observability, Electron desktop support, and real-time collaboration. The schema follows the roadmap’s emphasis on Postgres/data modeling, auth, permissions, payments, async jobs, observability, caching/rate limiting, and AI cost control. 

---

# 1. ERD design principles

## Primary design rules

1. **Every business resource is organization-scoped.**
   Documents, AI sessions, usage events, jobs, subscriptions, audit logs, and desktop uploads all belong to an organization.

2. **Auth provider is not the full user model.**
   Clerk or Supabase Auth owns authentication. Your `users` table is the app-level profile and relational anchor.

3. **Billing is organization-level, not user-level.**
   A subscription belongs to an organization. Users gain paid access through organization membership.

4. **Entitlements are computed server-side.**
   The client can display plan state, but the server decides whether an action is allowed.

5. **Usage is event-based.**
   Store immutable usage events, then optionally maintain aggregated counters for fast quota checks.

6. **AI requests are auditable and cost-trackable.**
   AI messages should store provider, model, token usage, cost estimates, status, and source citations.

7. **Document processing is async.**
   Uploading a document creates a document row and a background job. Processing state should be visible and retryable.

8. **Electron is not trusted.**
   Desktop installations can be tracked, but paid access must still be verified against the server.

---

# 2. ERD legend

```txt
PK  = Primary key
FK  = Foreign key
UQ  = Unique constraint
IDX = Index recommended
NN  = Not null
```

Recommended ID strategy:

```txt
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

Recommended timestamp convention:

```txt
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at TIMESTAMPTZ NULL
```

Recommended multi-tenant convention:

```txt
organization_id UUID NOT NULL REFERENCES organizations(id)
```

---

# 3. High-level domain map

```txt
Identity & tenancy
  users
  organizations
  organization_memberships
  invitations
  audit_logs

Billing & entitlements
  plans
  plan_limits
  billing_customers
  subscriptions
  stripe_events
  entitlement_checks

Documents & RAG
  storage_objects
  documents
  document_versions
  document_collections
  document_collection_items
  document_chunks

AI conversations
  prompt_versions
  ai_sessions
  ai_messages
  ai_message_sources
  ai_feedback

Usage, quotas, and cost
  usage_events
  usage_counters
  rate_limit_events

Async jobs
  jobs
  job_attempts

Notifications
  notifications
  email_events

Desktop companion
  desktop_installations
  desktop_sessions
  desktop_uploads

Real-time and collaboration
  realtime_rooms
  room_participants
  comments
```

---

# 4. Core ERD diagram

## 4.1 Identity, organizations, billing, usage, and audit

```mermaid
erDiagram
    USERS {
        uuid id PK
        text auth_provider NN
        text auth_provider_user_id NN UQ
        citext email NN UQ
        text display_name
        text avatar_url
        text timezone
        text status NN
        timestamptz last_seen_at
        timestamptz created_at NN
        timestamptz updated_at NN
        timestamptz deleted_at
    }

    ORGANIZATIONS {
        uuid id PK
        text name NN
        citext slug NN UQ
        uuid owner_user_id FK
        text status NN
        jsonb metadata
        timestamptz created_at NN
        timestamptz updated_at NN
        timestamptz deleted_at
    }

    ORGANIZATION_MEMBERSHIPS {
        uuid id PK
        uuid organization_id FK NN
        uuid user_id FK NN
        text role NN
        text status NN
        timestamptz joined_at
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    INVITATIONS {
        uuid id PK
        uuid organization_id FK NN
        citext email NN
        text role NN
        text token_hash NN UQ
        uuid invited_by_user_id FK NN
        uuid accepted_by_user_id FK
        text status NN
        timestamptz expires_at NN
        timestamptz accepted_at
        timestamptz revoked_at
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    PLANS {
        text id PK
        text name NN
        text billing_interval
        integer price_cents NN
        text currency NN
        text stripe_price_id UQ
        boolean is_active NN
        integer sort_order NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    PLAN_LIMITS {
        uuid id PK
        text plan_id FK NN
        text feature_key NN
        integer limit_value
        text limit_unit NN
        text reset_interval NN
        boolean hard_limit NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    BILLING_CUSTOMERS {
        uuid id PK
        uuid organization_id FK NN UQ
        text stripe_customer_id NN UQ
        citext billing_email
        uuid created_by_user_id FK
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid organization_id FK NN UQ
        uuid billing_customer_id FK
        text plan_id FK NN
        text stripe_subscription_id UQ
        text stripe_price_id
        text status NN
        integer seats NN
        timestamptz current_period_start
        timestamptz current_period_end
        boolean cancel_at_period_end NN
        timestamptz trial_end
        jsonb metadata
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    STRIPE_EVENTS {
        uuid id PK
        text stripe_event_id NN UQ
        text event_type NN
        text processing_status NN
        jsonb payload NN
        text error_message
        timestamptz received_at NN
        timestamptz processed_at
        timestamptz created_at NN
    }

    USAGE_EVENTS {
        uuid id PK
        uuid organization_id FK NN
        uuid user_id FK
        text feature_key NN
        text event_type NN
        numeric quantity NN
        text unit NN
        text provider
        text model_name
        integer input_tokens
        integer output_tokens
        integer total_tokens
        bigint cost_micro_usd
        text source_type
        uuid source_id
        text idempotency_key UQ
        jsonb metadata
        timestamptz billing_period_start
        timestamptz billing_period_end
        timestamptz created_at NN
    }

    USAGE_COUNTERS {
        uuid id PK
        uuid organization_id FK NN
        text feature_key NN
        timestamptz period_start NN
        timestamptz period_end NN
        numeric used_quantity NN
        numeric limit_quantity
        timestamptz updated_at NN
    }

    RATE_LIMIT_EVENTS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        text endpoint NN
        text limit_key NN
        text action NN
        integer tokens_consumed
        jsonb metadata
        timestamptz created_at NN
    }

    AUDIT_LOGS {
        uuid id PK
        uuid organization_id FK
        uuid actor_user_id FK
        text action NN
        text entity_type NN
        uuid entity_id
        jsonb before_state
        jsonb after_state
        jsonb metadata
        inet ip_address
        text user_agent
        timestamptz created_at NN
    }

    USERS ||--o{ ORGANIZATION_MEMBERSHIPS : has
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : has
    USERS ||--o{ ORGANIZATIONS : owns
    ORGANIZATIONS ||--o{ INVITATIONS : sends
    USERS ||--o{ INVITATIONS : invited_by
    USERS ||--o{ INVITATIONS : accepted_by

    PLANS ||--o{ PLAN_LIMITS : defines
    PLANS ||--o{ SUBSCRIPTIONS : used_by
    ORGANIZATIONS ||--|| BILLING_CUSTOMERS : has
    BILLING_CUSTOMERS ||--o{ SUBSCRIPTIONS : owns
    ORGANIZATIONS ||--|| SUBSCRIPTIONS : has

    ORGANIZATIONS ||--o{ USAGE_EVENTS : records
    USERS ||--o{ USAGE_EVENTS : causes
    ORGANIZATIONS ||--o{ USAGE_COUNTERS : aggregates
    ORGANIZATIONS ||--o{ RATE_LIMIT_EVENTS : tracks
    USERS ||--o{ RATE_LIMIT_EVENTS : triggers

    ORGANIZATIONS ||--o{ AUDIT_LOGS : has
    USERS ||--o{ AUDIT_LOGS : acts
```

---

## 4.2 Documents, storage, async processing, RAG, and AI chat

```mermaid
erDiagram
    STORAGE_OBJECTS {
        uuid id PK
        uuid organization_id FK NN
        text bucket NN
        text object_key NN UQ
        text original_filename NN
        text content_type NN
        bigint byte_size NN
        text checksum_sha256
        uuid uploaded_by_user_id FK
        text status NN
        timestamptz created_at NN
        timestamptz deleted_at
    }

    DOCUMENTS {
        uuid id PK
        uuid organization_id FK NN
        uuid storage_object_id FK
        uuid created_by_user_id FK NN
        text title NN
        text source_type NN
        text file_type NN
        text status NN
        text processing_error_code
        text processing_error_message
        integer page_count
        text language
        text checksum_sha256
        timestamptz ready_at
        timestamptz created_at NN
        timestamptz updated_at NN
        timestamptz deleted_at
    }

    DOCUMENT_VERSIONS {
        uuid id PK
        uuid organization_id FK NN
        uuid document_id FK NN
        uuid storage_object_id FK
        integer version_number NN
        text extraction_status NN
        timestamptz text_extracted_at
        uuid created_by_user_id FK
        timestamptz created_at NN
    }

    DOCUMENT_COLLECTIONS {
        uuid id PK
        uuid organization_id FK NN
        uuid created_by_user_id FK NN
        text name NN
        text description
        timestamptz created_at NN
        timestamptz updated_at NN
        timestamptz deleted_at
    }

    DOCUMENT_COLLECTION_ITEMS {
        uuid organization_id FK NN
        uuid collection_id FK NN
        uuid document_id FK NN
        uuid added_by_user_id FK
        timestamptz added_at NN
    }

    DOCUMENT_CHUNKS {
        uuid id PK
        uuid organization_id FK NN
        uuid document_id FK NN
        uuid document_version_id FK
        integer chunk_index NN
        text text NN
        integer token_count
        integer page_start
        integer page_end
        text section_title
        vector embedding
        text embedding_model
        jsonb metadata
        timestamptz created_at NN
    }

    JOBS {
        uuid id PK
        uuid organization_id FK
        uuid created_by_user_id FK
        text job_type NN
        text status NN
        jsonb payload NN
        text idempotency_key UQ
        integer attempts_count NN
        integer max_attempts NN
        timestamptz run_after NN
        text locked_by
        timestamptz locked_at
        text last_error_code
        text last_error_message
        timestamptz completed_at
        timestamptz failed_at
        timestamptz dead_lettered_at
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    JOB_ATTEMPTS {
        uuid id PK
        uuid job_id FK NN
        integer attempt_number NN
        text status NN
        text error_code
        text error_message
        jsonb metadata
        timestamptz started_at NN
        timestamptz ended_at
    }

    PROMPT_VERSIONS {
        uuid id PK
        text name NN
        integer version NN
        text prompt_template NN
        text default_model_provider
        text default_model_name
        boolean is_active NN
        uuid created_by_user_id FK
        timestamptz created_at NN
    }

    AI_SESSIONS {
        uuid id PK
        uuid organization_id FK NN
        uuid created_by_user_id FK NN
        uuid collection_id FK
        uuid document_id FK
        uuid prompt_version_id FK
        text title
        text visibility NN
        text status NN
        timestamptz created_at NN
        timestamptz updated_at NN
        timestamptz deleted_at
    }

    AI_MESSAGES {
        uuid id PK
        uuid organization_id FK NN
        uuid session_id FK NN
        uuid parent_message_id FK
        uuid created_by_user_id FK
        text role NN
        text content NN
        text status NN
        text model_provider
        text model_name
        integer input_tokens
        integer output_tokens
        integer total_tokens
        bigint cost_micro_usd
        text error_code
        text error_message
        timestamptz created_at NN
        timestamptz completed_at
    }

    AI_MESSAGE_SOURCES {
        uuid id PK
        uuid organization_id FK NN
        uuid ai_message_id FK NN
        uuid document_id FK NN
        uuid document_chunk_id FK NN
        numeric relevance_score
        text citation_label
        integer quote_start_char
        integer quote_end_char
        timestamptz created_at NN
    }

    AI_FEEDBACK {
        uuid id PK
        uuid organization_id FK NN
        uuid ai_message_id FK NN
        uuid user_id FK NN
        text rating NN
        text comment
        timestamptz created_at NN
    }

    ORGANIZATIONS ||--o{ STORAGE_OBJECTS : owns
    USERS ||--o{ STORAGE_OBJECTS : uploads

    ORGANIZATIONS ||--o{ DOCUMENTS : owns
    STORAGE_OBJECTS ||--o{ DOCUMENTS : backs
    USERS ||--o{ DOCUMENTS : creates

    DOCUMENTS ||--o{ DOCUMENT_VERSIONS : has
    STORAGE_OBJECTS ||--o{ DOCUMENT_VERSIONS : stores
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : splits_into
    DOCUMENT_VERSIONS ||--o{ DOCUMENT_CHUNKS : produces

    ORGANIZATIONS ||--o{ DOCUMENT_COLLECTIONS : owns
    DOCUMENT_COLLECTIONS ||--o{ DOCUMENT_COLLECTION_ITEMS : contains
    DOCUMENTS ||--o{ DOCUMENT_COLLECTION_ITEMS : included_in

    ORGANIZATIONS ||--o{ JOBS : has
    JOBS ||--o{ JOB_ATTEMPTS : records

    PROMPT_VERSIONS ||--o{ AI_SESSIONS : used_by
    ORGANIZATIONS ||--o{ AI_SESSIONS : owns
    USERS ||--o{ AI_SESSIONS : creates
    DOCUMENT_COLLECTIONS ||--o{ AI_SESSIONS : scopes
    DOCUMENTS ||--o{ AI_SESSIONS : scopes

    AI_SESSIONS ||--o{ AI_MESSAGES : contains
    USERS ||--o{ AI_MESSAGES : creates
    AI_MESSAGES ||--o{ AI_MESSAGES : replies_to

    AI_MESSAGES ||--o{ AI_MESSAGE_SOURCES : cites
    DOCUMENTS ||--o{ AI_MESSAGE_SOURCES : cited_document
    DOCUMENT_CHUNKS ||--o{ AI_MESSAGE_SOURCES : cited_chunk

    AI_MESSAGES ||--o{ AI_FEEDBACK : receives
    USERS ||--o{ AI_FEEDBACK : gives
```

---

## 4.3 Notifications, desktop app, and real-time collaboration

```mermaid
erDiagram
    NOTIFICATIONS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK NN
        text type NN
        text channel NN
        text title NN
        text body
        text status NN
        text source_type
        uuid source_id
        timestamptz created_at NN
        timestamptz sent_at
        timestamptz read_at
    }

    EMAIL_EVENTS {
        uuid id PK
        uuid notification_id FK
        uuid organization_id FK
        uuid user_id FK
        text provider_message_id UQ
        text template_key NN
        citext recipient_email NN
        text status NN
        text idempotency_key UQ
        text error_message
        timestamptz created_at NN
        timestamptz sent_at
        timestamptz delivered_at
    }

    DESKTOP_INSTALLATIONS {
        uuid id PK
        uuid user_id FK NN
        text device_name
        text platform NN
        text app_version NN
        text machine_fingerprint_hash NN
        text public_key
        text status NN
        timestamptz last_seen_at
        timestamptz created_at NN
        timestamptz updated_at NN
        timestamptz revoked_at
    }

    DESKTOP_SESSIONS {
        uuid id PK
        uuid installation_id FK NN
        uuid user_id FK NN
        uuid organization_id FK
        text session_status NN
        text entitlement_status
        timestamptz entitlement_checked_at
        timestamptz offline_grace_expires_at
        timestamptz created_at NN
        timestamptz last_seen_at
        timestamptz revoked_at
    }

    DESKTOP_UPLOADS {
        uuid id PK
        uuid organization_id FK NN
        uuid installation_id FK NN
        uuid document_id FK
        text local_file_name NN
        text local_file_fingerprint_hash
        text status NN
        text error_message
        timestamptz created_at NN
        timestamptz completed_at
    }

    ENTITLEMENT_CHECKS {
        uuid id PK
        uuid organization_id FK NN
        uuid user_id FK
        uuid desktop_session_id FK
        text feature_key NN
        text result NN
        text plan_id
        text subscription_status
        jsonb limits_snapshot
        text denial_reason
        timestamptz checked_at NN
    }

    REALTIME_ROOMS {
        uuid id PK
        uuid organization_id FK NN
        text room_type NN
        uuid entity_id NN
        text status NN
        timestamptz created_at NN
        timestamptz closed_at
    }

    ROOM_PARTICIPANTS {
        uuid id PK
        uuid room_id FK NN
        uuid user_id FK NN
        text role NN
        timestamptz joined_at NN
        timestamptz last_seen_at
        timestamptz left_at
    }

    COMMENTS {
        uuid id PK
        uuid organization_id FK NN
        uuid document_id FK
        uuid ai_session_id FK
        uuid parent_comment_id FK
        uuid author_user_id FK NN
        text body NN
        text status NN
        timestamptz created_at NN
        timestamptz updated_at NN
        timestamptz deleted_at
    }

    ORGANIZATIONS ||--o{ NOTIFICATIONS : has
    USERS ||--o{ NOTIFICATIONS : receives
    NOTIFICATIONS ||--o{ EMAIL_EVENTS : emits

    USERS ||--o{ DESKTOP_INSTALLATIONS : owns
    DESKTOP_INSTALLATIONS ||--o{ DESKTOP_SESSIONS : creates
    USERS ||--o{ DESKTOP_SESSIONS : uses
    ORGANIZATIONS ||--o{ DESKTOP_SESSIONS : scopes

    DESKTOP_INSTALLATIONS ||--o{ DESKTOP_UPLOADS : performs
    ORGANIZATIONS ||--o{ DESKTOP_UPLOADS : owns
    DOCUMENTS ||--o{ DESKTOP_UPLOADS : creates

    ORGANIZATIONS ||--o{ ENTITLEMENT_CHECKS : has
    USERS ||--o{ ENTITLEMENT_CHECKS : requests
    DESKTOP_SESSIONS ||--o{ ENTITLEMENT_CHECKS : triggers

    ORGANIZATIONS ||--o{ REALTIME_ROOMS : owns
    REALTIME_ROOMS ||--o{ ROOM_PARTICIPANTS : has
    USERS ||--o{ ROOM_PARTICIPANTS : joins

    ORGANIZATIONS ||--o{ COMMENTS : owns
    DOCUMENTS ||--o{ COMMENTS : has
    AI_SESSIONS ||--o{ COMMENTS : has
    COMMENTS ||--o{ COMMENTS : replies_to
    USERS ||--o{ COMMENTS : writes
```

---

# 5. Detailed table specifications

## 5.1 `users`

App-level user profile.

| Column                  | Type        | Notes                            |
| ----------------------- | ----------- | -------------------------------- |
| `id`                    | UUID PK     | Internal app user ID             |
| `auth_provider`         | TEXT        | `clerk`, `supabase`, etc.        |
| `auth_provider_user_id` | TEXT UQ     | External auth ID                 |
| `email`                 | CITEXT UQ   | Case-insensitive email           |
| `display_name`          | TEXT        | User-facing name                 |
| `avatar_url`            | TEXT        | Optional                         |
| `timezone`              | TEXT        | Useful for billing/usage display |
| `status`                | TEXT        | `active`, `disabled`, `deleted`  |
| `last_seen_at`          | TIMESTAMPTZ | For activity tracking            |
| `created_at`            | TIMESTAMPTZ | Required                         |
| `updated_at`            | TIMESTAMPTZ | Required                         |
| `deleted_at`            | TIMESTAMPTZ | Soft delete                      |

Recommended constraints:

```txt
UNIQUE(auth_provider, auth_provider_user_id)
UNIQUE(email)
```

---

## 5.2 `organizations`

Tenant/workspace boundary.

| Column          | Type               | Notes                            |
| --------------- | ------------------ | -------------------------------- |
| `id`            | UUID PK            | Organization ID                  |
| `name`          | TEXT               | Display name                     |
| `slug`          | CITEXT UQ          | URL-safe org slug                |
| `owner_user_id` | UUID FK → users.id | Primary owner                    |
| `status`        | TEXT               | `active`, `suspended`, `deleted` |
| `metadata`      | JSONB              | Optional                         |
| `created_at`    | TIMESTAMPTZ        | Required                         |
| `updated_at`    | TIMESTAMPTZ        | Required                         |
| `deleted_at`    | TIMESTAMPTZ        | Soft delete                      |

Recommended indexes:

```txt
UNIQUE(slug)
INDEX(owner_user_id)
INDEX(status)
```

---

## 5.3 `organization_memberships`

Connects users to organizations with roles.

| Column            | Type                       | Notes                                       |
| ----------------- | -------------------------- | ------------------------------------------- |
| `id`              | UUID PK                    | Membership ID                               |
| `organization_id` | UUID FK → organizations.id | Tenant                                      |
| `user_id`         | UUID FK → users.id         | Member                                      |
| `role`            | TEXT                       | `owner`, `admin`, `member`                  |
| `status`          | TEXT                       | `active`, `invited`, `suspended`, `removed` |
| `joined_at`       | TIMESTAMPTZ                | When membership became active               |
| `created_at`      | TIMESTAMPTZ                | Required                                    |
| `updated_at`      | TIMESTAMPTZ                | Required                                    |

Recommended constraints:

```txt
UNIQUE(organization_id, user_id)
CHECK(role IN ('owner', 'admin', 'member'))
CHECK(status IN ('active', 'invited', 'suspended', 'removed'))
```

Recommended indexes:

```txt
INDEX(user_id, organization_id)
INDEX(organization_id, role)
INDEX(organization_id, status)
```

---

## 5.4 `invitations`

Pending invitations to join an organization.

| Column                | Type                       | Notes                                       |
| --------------------- | -------------------------- | ------------------------------------------- |
| `id`                  | UUID PK                    | Invitation ID                               |
| `organization_id`     | UUID FK → organizations.id | Target org                                  |
| `email`               | CITEXT                     | Invitee email                               |
| `role`                | TEXT                       | Role granted on accept                      |
| `token_hash`          | TEXT UQ                    | Store hash, not raw token                   |
| `invited_by_user_id`  | UUID FK → users.id         | Actor                                       |
| `accepted_by_user_id` | UUID FK → users.id         | User who accepted                           |
| `status`              | TEXT                       | `pending`, `accepted`, `revoked`, `expired` |
| `expires_at`          | TIMESTAMPTZ                | Required                                    |
| `accepted_at`         | TIMESTAMPTZ                | Nullable                                    |
| `revoked_at`          | TIMESTAMPTZ                | Nullable                                    |
| `created_at`          | TIMESTAMPTZ                | Required                                    |
| `updated_at`          | TIMESTAMPTZ                | Required                                    |

Recommended indexes:

```txt
INDEX(organization_id, email)
INDEX(token_hash)
INDEX(status, expires_at)
```

---

# 6. Billing and entitlement tables

## 6.1 `plans`

Internal plan definitions.

| Column             | Type        | Notes                   |
| ------------------ | ----------- | ----------------------- |
| `id`               | TEXT PK     | `free`, `pro`, `team`   |
| `name`             | TEXT        | Display name            |
| `billing_interval` | TEXT        | `none`, `month`, `year` |
| `price_cents`      | INTEGER     | 0 for free              |
| `currency`         | TEXT        | Usually `usd`           |
| `stripe_price_id`  | TEXT UQ     | Nullable for free       |
| `is_active`        | BOOLEAN     | Whether selectable      |
| `sort_order`       | INTEGER     | Pricing page order      |
| `created_at`       | TIMESTAMPTZ | Required                |
| `updated_at`       | TIMESTAMPTZ | Required                |

Example rows:

```txt
free
pro_monthly
pro_yearly
team_monthly
```

---

## 6.2 `plan_limits`

Feature limits per plan.

| Column           | Type               | Notes                                    |
| ---------------- | ------------------ | ---------------------------------------- |
| `id`             | UUID PK            | Limit ID                                 |
| `plan_id`        | TEXT FK → plans.id | Plan                                     |
| `feature_key`    | TEXT               | `ai_messages`, `document_uploads`, etc.  |
| `limit_value`    | INTEGER            | Nullable for unlimited                   |
| `limit_unit`     | TEXT               | `count`, `mb`, `tokens`, `seats`         |
| `reset_interval` | TEXT               | `day`, `month`, `billing_period`, `none` |
| `hard_limit`     | BOOLEAN            | Whether to block when exceeded           |
| `created_at`     | TIMESTAMPTZ        | Required                                 |
| `updated_at`     | TIMESTAMPTZ        | Required                                 |

Recommended constraint:

```txt
UNIQUE(plan_id, feature_key)
```

Example rows:

| plan_id     |      feature_key | limit_value | reset_interval |
| ----------- | ---------------: | ----------: | -------------- |
| free        |      ai_messages |          10 | day            |
| free        | document_uploads |           3 | day            |
| free        | max_file_size_mb |           5 | none           |
| pro_monthly |      ai_messages |         500 | billing_period |
| pro_monthly | document_uploads |         100 | billing_period |
| pro_monthly | max_file_size_mb |          50 | none           |

---

## 6.3 `billing_customers`

Maps an organization to Stripe customer state.

| Column               | Type                          | Notes                        |
| -------------------- | ----------------------------- | ---------------------------- |
| `id`                 | UUID PK                       | Internal customer row        |
| `organization_id`    | UUID FK → organizations.id UQ | One billing customer per org |
| `stripe_customer_id` | TEXT UQ                       | Stripe customer ID           |
| `billing_email`      | CITEXT                        | Billing contact              |
| `created_by_user_id` | UUID FK → users.id            | Who initiated billing        |
| `created_at`         | TIMESTAMPTZ                   | Required                     |
| `updated_at`         | TIMESTAMPTZ                   | Required                     |

Recommended constraints:

```txt
UNIQUE(organization_id)
UNIQUE(stripe_customer_id)
```

---

## 6.4 `subscriptions`

Current subscription state for an organization.

| Column                   | Type                           | Notes                                 |
| ------------------------ | ------------------------------ | ------------------------------------- |
| `id`                     | UUID PK                        | Subscription row                      |
| `organization_id`        | UUID FK → organizations.id UQ  | One active subscription state per org |
| `billing_customer_id`    | UUID FK → billing_customers.id | Nullable for free plan                |
| `plan_id`                | TEXT FK → plans.id             | Current plan                          |
| `stripe_subscription_id` | TEXT UQ                        | Nullable for free                     |
| `stripe_price_id`        | TEXT                           | Stripe price                          |
| `status`                 | TEXT                           | Stripe/app subscription status        |
| `seats`                  | INTEGER                        | Seat count                            |
| `current_period_start`   | TIMESTAMPTZ                    | Billing period start                  |
| `current_period_end`     | TIMESTAMPTZ                    | Billing period end                    |
| `cancel_at_period_end`   | BOOLEAN                        | Stripe cancel behavior                |
| `trial_end`              | TIMESTAMPTZ                    | Nullable                              |
| `metadata`               | JSONB                          | Optional                              |
| `created_at`             | TIMESTAMPTZ                    | Required                              |
| `updated_at`             | TIMESTAMPTZ                    | Required                              |

Recommended statuses:

```txt
free
trialing
active
past_due
canceled
unpaid
incomplete
incomplete_expired
```

Recommended indexes:

```txt
UNIQUE(organization_id)
UNIQUE(stripe_subscription_id)
INDEX(status)
INDEX(current_period_end)
```

---

## 6.5 `stripe_events`

Webhook idempotency table.

| Column              | Type        | Notes                                        |
| ------------------- | ----------- | -------------------------------------------- |
| `id`                | UUID PK     | Internal event row                           |
| `stripe_event_id`   | TEXT UQ     | Stripe event ID                              |
| `event_type`        | TEXT        | `checkout.session.completed`, etc.           |
| `processing_status` | TEXT        | `received`, `processed`, `failed`, `ignored` |
| `payload`           | JSONB       | Raw webhook payload                          |
| `error_message`     | TEXT        | Failure reason                               |
| `received_at`       | TIMESTAMPTZ | When app received it                         |
| `processed_at`      | TIMESTAMPTZ | When processed                               |
| `created_at`        | TIMESTAMPTZ | Required                                     |

Critical constraint:

```txt
UNIQUE(stripe_event_id)
```

This prevents duplicate webhook side effects.

---

## 6.6 `entitlement_checks`

Optional but useful for audit/debug, especially with desktop clients.

| Column                | Type                          | Notes                   |
| --------------------- | ----------------------------- | ----------------------- |
| `id`                  | UUID PK                       | Check ID                |
| `organization_id`     | UUID FK → organizations.id    | Target org              |
| `user_id`             | UUID FK → users.id            | Requesting user         |
| `desktop_session_id`  | UUID FK → desktop_sessions.id | Nullable                |
| `feature_key`         | TEXT                          | Feature being checked   |
| `result`              | TEXT                          | `allowed`, `denied`     |
| `plan_id`             | TEXT                          | Snapshot                |
| `subscription_status` | TEXT                          | Snapshot                |
| `limits_snapshot`     | JSONB                         | Limits at time of check |
| `denial_reason`       | TEXT                          | Why denied              |
| `checked_at`          | TIMESTAMPTZ                   | Required                |

Recommended indexes:

```txt
INDEX(organization_id, checked_at)
INDEX(user_id, checked_at)
INDEX(feature_key, result)
```

---

# 7. Usage, quota, and cost tables

## 7.1 `usage_events`

Immutable event log for quota and cost tracking.

| Column                 | Type                       | Notes                                          |
| ---------------------- | -------------------------- | ---------------------------------------------- |
| `id`                   | UUID PK                    | Usage event                                    |
| `organization_id`      | UUID FK → organizations.id | Tenant                                         |
| `user_id`              | UUID FK → users.id         | Nullable for system events                     |
| `feature_key`          | TEXT                       | `ai_messages`, `embedding_tokens`, etc.        |
| `event_type`           | TEXT                       | `ai_chat_completed`, `document_uploaded`, etc. |
| `quantity`             | NUMERIC                    | Amount consumed                                |
| `unit`                 | TEXT                       | `count`, `tokens`, `bytes`, `micro_usd`        |
| `provider`             | TEXT                       | AI/provider name                               |
| `model_name`           | TEXT                       | Model                                          |
| `input_tokens`         | INTEGER                    | Prompt tokens                                  |
| `output_tokens`        | INTEGER                    | Completion tokens                              |
| `total_tokens`         | INTEGER                    | Total tokens                                   |
| `cost_micro_usd`       | BIGINT                     | Estimated cost                                 |
| `source_type`          | TEXT                       | `ai_message`, `document`, `job`, etc.          |
| `source_id`            | UUID                       | Related row                                    |
| `idempotency_key`      | TEXT UQ                    | Prevent duplicate billing/usage events         |
| `metadata`             | JSONB                      | Extra details                                  |
| `billing_period_start` | TIMESTAMPTZ                | Useful for subscriptions                       |
| `billing_period_end`   | TIMESTAMPTZ                | Useful for subscriptions                       |
| `created_at`           | TIMESTAMPTZ                | Required                                       |

Recommended indexes:

```txt
INDEX(organization_id, created_at)
INDEX(organization_id, feature_key, created_at)
INDEX(user_id, created_at)
UNIQUE(idempotency_key)
```

---

## 7.2 `usage_counters`

Fast aggregated quota lookups.

| Column            | Type                       | Notes             |
| ----------------- | -------------------------- | ----------------- |
| `id`              | UUID PK                    | Counter ID        |
| `organization_id` | UUID FK → organizations.id | Tenant            |
| `feature_key`     | TEXT                       | Feature           |
| `period_start`    | TIMESTAMPTZ                | Window start      |
| `period_end`      | TIMESTAMPTZ                | Window end        |
| `used_quantity`   | NUMERIC                    | Aggregated usage  |
| `limit_quantity`  | NUMERIC                    | Snapshot of limit |
| `updated_at`      | TIMESTAMPTZ                | Required          |

Recommended constraint:

```txt
UNIQUE(organization_id, feature_key, period_start, period_end)
```

Use this table for fast checks, but keep `usage_events` as the source of truth.

---

## 7.3 `rate_limit_events`

Optional persistent log of rate-limit decisions.

| Column            | Type                       | Notes                |
| ----------------- | -------------------------- | -------------------- |
| `id`              | UUID PK                    | Event ID             |
| `organization_id` | UUID FK → organizations.id | Nullable             |
| `user_id`         | UUID FK → users.id         | Nullable             |
| `endpoint`        | TEXT                       | `/api/ai/chat`, etc. |
| `limit_key`       | TEXT                       | Redis/key identifier |
| `action`          | TEXT                       | `allowed`, `blocked` |
| `tokens_consumed` | INTEGER                    | Request weight       |
| `metadata`        | JSONB                      | Extra                |
| `created_at`      | TIMESTAMPTZ                | Required             |

Recommended indexes:

```txt
INDEX(organization_id, created_at)
INDEX(user_id, created_at)
INDEX(endpoint, created_at)
INDEX(action, created_at)
```

---

# 8. Document and RAG tables

## 8.1 `storage_objects`

Metadata for files in R2, Supabase Storage, or another object store.

| Column                | Type                       | Notes                                |
| --------------------- | -------------------------- | ------------------------------------ |
| `id`                  | UUID PK                    | Storage object                       |
| `organization_id`     | UUID FK → organizations.id | Tenant                               |
| `bucket`              | TEXT                       | Storage bucket                       |
| `object_key`          | TEXT UQ                    | Storage key/path                     |
| `original_filename`   | TEXT                       | User filename                        |
| `content_type`        | TEXT                       | MIME type                            |
| `byte_size`           | BIGINT                     | File size                            |
| `checksum_sha256`     | TEXT                       | Dedup/integrity                      |
| `uploaded_by_user_id` | UUID FK → users.id         | Actor                                |
| `status`              | TEXT                       | `uploaded`, `deleted`, `quarantined` |
| `created_at`          | TIMESTAMPTZ                | Required                             |
| `deleted_at`          | TIMESTAMPTZ                | Soft delete                          |

Recommended constraints:

```txt
UNIQUE(bucket, object_key)
INDEX(organization_id, created_at)
INDEX(checksum_sha256)
```

---

## 8.2 `documents`

User-facing document record.

| Column                     | Type                         | Notes                                        |
| -------------------------- | ---------------------------- | -------------------------------------------- |
| `id`                       | UUID PK                      | Document ID                                  |
| `organization_id`          | UUID FK → organizations.id   | Tenant                                       |
| `storage_object_id`        | UUID FK → storage_objects.id | Original file                                |
| `created_by_user_id`       | UUID FK → users.id           | Uploader                                     |
| `title`                    | TEXT                         | Display title                                |
| `source_type`              | TEXT                         | `web_upload`, `desktop_upload`, `api`, `url` |
| `file_type`                | TEXT                         | `pdf`, `txt`, `md`, etc.                     |
| `status`                   | TEXT                         | Processing status                            |
| `processing_error_code`    | TEXT                         | Nullable                                     |
| `processing_error_message` | TEXT                         | Nullable                                     |
| `page_count`               | INTEGER                      | Nullable                                     |
| `language`                 | TEXT                         | Nullable                                     |
| `checksum_sha256`          | TEXT                         | File checksum                                |
| `ready_at`                 | TIMESTAMPTZ                  | When available for RAG                       |
| `created_at`               | TIMESTAMPTZ                  | Required                                     |
| `updated_at`               | TIMESTAMPTZ                  | Required                                     |
| `deleted_at`               | TIMESTAMPTZ                  | Soft delete                                  |

Recommended document statuses:

```txt
uploaded
queued
processing
chunking
embedding
indexed
ready
failed
deleted
```

Recommended indexes:

```txt
INDEX(organization_id, status)
INDEX(organization_id, created_at)
INDEX(created_by_user_id, created_at)
INDEX(checksum_sha256)
```

---

## 8.3 `document_versions`

Optional but useful if documents can be replaced or reprocessed.

| Column               | Type                         | Notes                            |
| -------------------- | ---------------------------- | -------------------------------- |
| `id`                 | UUID PK                      | Version ID                       |
| `organization_id`    | UUID FK → organizations.id   | Tenant                           |
| `document_id`        | UUID FK → documents.id       | Parent document                  |
| `storage_object_id`  | UUID FK → storage_objects.id | Version file                     |
| `version_number`     | INTEGER                      | 1, 2, 3...                       |
| `extraction_status`  | TEXT                         | `pending`, `extracted`, `failed` |
| `text_extracted_at`  | TIMESTAMPTZ                  | Nullable                         |
| `created_by_user_id` | UUID FK → users.id           | Actor                            |
| `created_at`         | TIMESTAMPTZ                  | Required                         |

Recommended constraint:

```txt
UNIQUE(document_id, version_number)
```

For MVP, you can skip versioning and add it later.

---

## 8.4 `document_collections`

Groups documents for scoped AI chats.

| Column               | Type                       | Notes           |
| -------------------- | -------------------------- | --------------- |
| `id`                 | UUID PK                    | Collection ID   |
| `organization_id`    | UUID FK → organizations.id | Tenant          |
| `created_by_user_id` | UUID FK → users.id         | Creator         |
| `name`               | TEXT                       | Collection name |
| `description`        | TEXT                       | Optional        |
| `created_at`         | TIMESTAMPTZ                | Required        |
| `updated_at`         | TIMESTAMPTZ                | Required        |
| `deleted_at`         | TIMESTAMPTZ                | Soft delete     |

Recommended constraint:

```txt
UNIQUE(organization_id, name)
```

---

## 8.5 `document_collection_items`

Join table for many-to-many relationship between documents and collections.

| Column             | Type                              | Notes      |
| ------------------ | --------------------------------- | ---------- |
| `organization_id`  | UUID FK → organizations.id        | Tenant     |
| `collection_id`    | UUID FK → document_collections.id | Collection |
| `document_id`      | UUID FK → documents.id            | Document   |
| `added_by_user_id` | UUID FK → users.id                | Actor      |
| `added_at`         | TIMESTAMPTZ                       | Required   |

Recommended constraint:

```txt
PRIMARY KEY(collection_id, document_id)
INDEX(organization_id, collection_id)
INDEX(organization_id, document_id)
```

---

## 8.6 `document_chunks`

Searchable RAG chunks.

| Column                | Type                           | Notes                            |
| --------------------- | ------------------------------ | -------------------------------- |
| `id`                  | UUID PK                        | Chunk ID                         |
| `organization_id`     | UUID FK → organizations.id     | Tenant                           |
| `document_id`         | UUID FK → documents.id         | Parent document                  |
| `document_version_id` | UUID FK → document_versions.id | Nullable if no versioning        |
| `chunk_index`         | INTEGER                        | Position within document/version |
| `text`                | TEXT                           | Chunk text                       |
| `token_count`         | INTEGER                        | Estimated tokens                 |
| `page_start`          | INTEGER                        | Nullable                         |
| `page_end`            | INTEGER                        | Nullable                         |
| `section_title`       | TEXT                           | Nullable                         |
| `embedding`           | VECTOR                         | pgvector column                  |
| `embedding_model`     | TEXT                           | Model used                       |
| `metadata`            | JSONB                          | Extra source data                |
| `created_at`          | TIMESTAMPTZ                    | Required                         |

Recommended constraints:

```txt
UNIQUE(document_version_id, chunk_index)
```

Recommended indexes:

```txt
INDEX(organization_id, document_id)
INDEX(organization_id, created_at)
VECTOR INDEX ON embedding
```

Important security rule:

```txt
All retrieval queries must filter by organization_id.
```

---

# 9. Async job tables

## 9.1 `jobs`

General background job queue state.

| Column               | Type                       | Notes                                  |
| -------------------- | -------------------------- | -------------------------------------- |
| `id`                 | UUID PK                    | Job ID                                 |
| `organization_id`    | UUID FK → organizations.id | Nullable for global jobs               |
| `created_by_user_id` | UUID FK → users.id         | Nullable for system jobs               |
| `job_type`           | TEXT                       | `process_document`, `send_email`, etc. |
| `status`             | TEXT                       | Job status                             |
| `payload`            | JSONB                      | Job input                              |
| `idempotency_key`    | TEXT UQ                    | Prevent duplicate jobs                 |
| `attempts_count`     | INTEGER                    | Current attempts                       |
| `max_attempts`       | INTEGER                    | Max attempts                           |
| `run_after`          | TIMESTAMPTZ                | Scheduling/backoff                     |
| `locked_by`          | TEXT                       | Worker ID                              |
| `locked_at`          | TIMESTAMPTZ                | Worker lock time                       |
| `last_error_code`    | TEXT                       | Last failure code                      |
| `last_error_message` | TEXT                       | Last failure message                   |
| `completed_at`       | TIMESTAMPTZ                | Nullable                               |
| `failed_at`          | TIMESTAMPTZ                | Nullable                               |
| `dead_lettered_at`   | TIMESTAMPTZ                | Nullable                               |
| `created_at`         | TIMESTAMPTZ                | Required                               |
| `updated_at`         | TIMESTAMPTZ                | Required                               |

Recommended statuses:

```txt
pending
processing
retrying
completed
failed
dead_lettered
canceled
```

Recommended indexes:

```txt
INDEX(status, run_after)
INDEX(organization_id, status)
UNIQUE(idempotency_key)
```

---

## 9.2 `job_attempts`

Attempt-level observability for background jobs.

| Column           | Type              | Notes                                         |
| ---------------- | ----------------- | --------------------------------------------- |
| `id`             | UUID PK           | Attempt ID                                    |
| `job_id`         | UUID FK → jobs.id | Parent job                                    |
| `attempt_number` | INTEGER           | 1, 2, 3...                                    |
| `status`         | TEXT              | `started`, `succeeded`, `failed`, `timed_out` |
| `error_code`     | TEXT              | Nullable                                      |
| `error_message`  | TEXT              | Nullable                                      |
| `metadata`       | JSONB             | Worker logs/context                           |
| `started_at`     | TIMESTAMPTZ       | Required                                      |
| `ended_at`       | TIMESTAMPTZ       | Nullable                                      |

Recommended constraint:

```txt
UNIQUE(job_id, attempt_number)
```

---

# 10. AI tables

## 10.1 `prompt_versions`

Versioned prompt templates.

| Column                   | Type               | Notes                          |
| ------------------------ | ------------------ | ------------------------------ |
| `id`                     | UUID PK            | Prompt version ID              |
| `name`                   | TEXT               | `document_qa`, `summary`, etc. |
| `version`                | INTEGER            | Incrementing                   |
| `prompt_template`        | TEXT               | Template content               |
| `default_model_provider` | TEXT               | Optional                       |
| `default_model_name`     | TEXT               | Optional                       |
| `is_active`              | BOOLEAN            | Active default                 |
| `created_by_user_id`     | UUID FK → users.id | Nullable/system                |
| `created_at`             | TIMESTAMPTZ        | Required                       |

Recommended constraint:

```txt
UNIQUE(name, version)
```

---

## 10.2 `ai_sessions`

Conversation container.

| Column               | Type                              | Notes                               |
| -------------------- | --------------------------------- | ----------------------------------- |
| `id`                 | UUID PK                           | Session ID                          |
| `organization_id`    | UUID FK → organizations.id        | Tenant                              |
| `created_by_user_id` | UUID FK → users.id                | Creator                             |
| `collection_id`      | UUID FK → document_collections.id | Nullable                            |
| `document_id`        | UUID FK → documents.id            | Nullable                            |
| `prompt_version_id`  | UUID FK → prompt_versions.id      | Nullable                            |
| `title`              | TEXT                              | Optional                            |
| `visibility`         | TEXT                              | `private`, `organization`, `shared` |
| `status`             | TEXT                              | `active`, `archived`, `deleted`     |
| `created_at`         | TIMESTAMPTZ                       | Required                            |
| `updated_at`         | TIMESTAMPTZ                       | Required                            |
| `deleted_at`         | TIMESTAMPTZ                       | Soft delete                         |

Recommended indexes:

```txt
INDEX(organization_id, created_at)
INDEX(created_by_user_id, created_at)
INDEX(organization_id, status)
```

---

## 10.3 `ai_messages`

Stores user and assistant messages.

| Column               | Type                       | Notes                                          |
| -------------------- | -------------------------- | ---------------------------------------------- |
| `id`                 | UUID PK                    | Message ID                                     |
| `organization_id`    | UUID FK → organizations.id | Tenant                                         |
| `session_id`         | UUID FK → ai_sessions.id   | Parent session                                 |
| `parent_message_id`  | UUID FK → ai_messages.id   | Optional threading                             |
| `created_by_user_id` | UUID FK → users.id         | Nullable for assistant/system                  |
| `role`               | TEXT                       | `user`, `assistant`, `system`, `tool`          |
| `content`            | TEXT                       | Message content                                |
| `status`             | TEXT                       | `streaming`, `completed`, `failed`, `canceled` |
| `model_provider`     | TEXT                       | OpenAI, Anthropic, etc.                        |
| `model_name`         | TEXT                       | Model                                          |
| `input_tokens`       | INTEGER                    | Nullable                                       |
| `output_tokens`      | INTEGER                    | Nullable                                       |
| `total_tokens`       | INTEGER                    | Nullable                                       |
| `cost_micro_usd`     | BIGINT                     | Estimated cost                                 |
| `error_code`         | TEXT                       | Nullable                                       |
| `error_message`      | TEXT                       | Nullable                                       |
| `created_at`         | TIMESTAMPTZ                | Required                                       |
| `completed_at`       | TIMESTAMPTZ                | Nullable                                       |

Recommended indexes:

```txt
INDEX(organization_id, session_id, created_at)
INDEX(session_id, created_at)
INDEX(organization_id, created_at)
INDEX(model_provider, model_name)
```

---

## 10.4 `ai_message_sources`

Citations linking AI answers to document chunks.

| Column              | Type                         | Notes                           |
| ------------------- | ---------------------------- | ------------------------------- |
| `id`                | UUID PK                      | Source ID                       |
| `organization_id`   | UUID FK → organizations.id   | Tenant                          |
| `ai_message_id`     | UUID FK → ai_messages.id     | Usually assistant message       |
| `document_id`       | UUID FK → documents.id       | Denormalized for easier display |
| `document_chunk_id` | UUID FK → document_chunks.id | Cited chunk                     |
| `relevance_score`   | NUMERIC                      | Retrieval score                 |
| `citation_label`    | TEXT                         | `[1]`, `Source A`, etc.         |
| `quote_start_char`  | INTEGER                      | Optional                        |
| `quote_end_char`    | INTEGER                      | Optional                        |
| `created_at`        | TIMESTAMPTZ                  | Required                        |

Recommended constraints:

```txt
UNIQUE(ai_message_id, document_chunk_id)
INDEX(organization_id, ai_message_id)
INDEX(document_id)
```

---

## 10.5 `ai_feedback`

User feedback on AI answers.

| Column            | Type                       | Notes                        |
| ----------------- | -------------------------- | ---------------------------- |
| `id`              | UUID PK                    | Feedback ID                  |
| `organization_id` | UUID FK → organizations.id | Tenant                       |
| `ai_message_id`   | UUID FK → ai_messages.id   | Message                      |
| `user_id`         | UUID FK → users.id         | Reviewer                     |
| `rating`          | TEXT                       | `up`, `down`, `1`, `2`, etc. |
| `comment`         | TEXT                       | Optional                     |
| `created_at`      | TIMESTAMPTZ                | Required                     |

Recommended constraint:

```txt
UNIQUE(ai_message_id, user_id)
```

---

# 11. Notifications and email tables

## 11.1 `notifications`

In-app, email, or desktop notifications.

| Column            | Type                       | Notes                               |
| ----------------- | -------------------------- | ----------------------------------- |
| `id`              | UUID PK                    | Notification ID                     |
| `organization_id` | UUID FK → organizations.id | Nullable                            |
| `user_id`         | UUID FK → users.id         | Recipient                           |
| `type`            | TEXT                       | `document_ready`, `invite`, etc.    |
| `channel`         | TEXT                       | `in_app`, `email`, `desktop`        |
| `title`           | TEXT                       | Display title                       |
| `body`            | TEXT                       | Optional                            |
| `status`          | TEXT                       | `pending`, `sent`, `failed`, `read` |
| `source_type`     | TEXT                       | `document`, `job`, `invitation`     |
| `source_id`       | UUID                       | Related row                         |
| `created_at`      | TIMESTAMPTZ                | Required                            |
| `sent_at`         | TIMESTAMPTZ                | Nullable                            |
| `read_at`         | TIMESTAMPTZ                | Nullable                            |

---

## 11.2 `email_events`

Tracks transactional email delivery and idempotency.

| Column                | Type                       | Notes                                              |
| --------------------- | -------------------------- | -------------------------------------------------- |
| `id`                  | UUID PK                    | Email event                                        |
| `notification_id`     | UUID FK → notifications.id | Nullable                                           |
| `organization_id`     | UUID FK → organizations.id | Nullable                                           |
| `user_id`             | UUID FK → users.id         | Nullable                                           |
| `provider_message_id` | TEXT UQ                    | Provider ID                                        |
| `template_key`        | TEXT                       | `invite_member`, etc.                              |
| `recipient_email`     | CITEXT                     | Recipient                                          |
| `status`              | TEXT                       | `queued`, `sent`, `delivered`, `bounced`, `failed` |
| `idempotency_key`     | TEXT UQ                    | Prevent duplicate sends                            |
| `error_message`       | TEXT                       | Nullable                                           |
| `created_at`          | TIMESTAMPTZ                | Required                                           |
| `sent_at`             | TIMESTAMPTZ                | Nullable                                           |
| `delivered_at`        | TIMESTAMPTZ                | Nullable                                           |

---

# 12. Desktop companion tables

## 12.1 `desktop_installations`

Tracks installed desktop clients.

| Column                     | Type               | Notes                        |
| -------------------------- | ------------------ | ---------------------------- |
| `id`                       | UUID PK            | Installation ID              |
| `user_id`                  | UUID FK → users.id | Owner                        |
| `device_name`              | TEXT               | User/device label            |
| `platform`                 | TEXT               | `macos`, `windows`, `linux`  |
| `app_version`              | TEXT               | Desktop app version          |
| `machine_fingerprint_hash` | TEXT               | Hashed identifier            |
| `public_key`               | TEXT               | Optional device public key   |
| `status`                   | TEXT               | `active`, `revoked`, `stale` |
| `last_seen_at`             | TIMESTAMPTZ        | Last heartbeat               |
| `created_at`               | TIMESTAMPTZ        | Required                     |
| `updated_at`               | TIMESTAMPTZ        | Required                     |
| `revoked_at`               | TIMESTAMPTZ        | Nullable                     |

Recommended constraints:

```txt
UNIQUE(user_id, machine_fingerprint_hash)
```

---

## 12.2 `desktop_sessions`

Tracks authenticated desktop sessions.

| Column                     | Type                               | Notes                               |
| -------------------------- | ---------------------------------- | ----------------------------------- |
| `id`                       | UUID PK                            | Session ID                          |
| `installation_id`          | UUID FK → desktop_installations.id | Device                              |
| `user_id`                  | UUID FK → users.id                 | User                                |
| `organization_id`          | UUID FK → organizations.id         | Current org                         |
| `session_status`           | TEXT                               | `active`, `revoked`, `expired`      |
| `entitlement_status`       | TEXT                               | `allowed`, `denied`, `grace_period` |
| `entitlement_checked_at`   | TIMESTAMPTZ                        | Last server check                   |
| `offline_grace_expires_at` | TIMESTAMPTZ                        | Desktop offline support             |
| `created_at`               | TIMESTAMPTZ                        | Required                            |
| `last_seen_at`             | TIMESTAMPTZ                        | Required                            |
| `revoked_at`               | TIMESTAMPTZ                        | Nullable                            |

---

## 12.3 `desktop_uploads`

Tracks uploads initiated from the desktop app.

| Column                        | Type                               | Notes                                       |
| ----------------------------- | ---------------------------------- | ------------------------------------------- |
| `id`                          | UUID PK                            | Desktop upload ID                           |
| `organization_id`             | UUID FK → organizations.id         | Tenant                                      |
| `installation_id`             | UUID FK → desktop_installations.id | Device                                      |
| `document_id`                 | UUID FK → documents.id             | Result document                             |
| `local_file_name`             | TEXT                               | Do not store full path by default           |
| `local_file_fingerprint_hash` | TEXT                               | Optional dedupe                             |
| `status`                      | TEXT                               | `started`, `uploaded`, `failed`, `canceled` |
| `error_message`               | TEXT                               | Nullable                                    |
| `created_at`                  | TIMESTAMPTZ                        | Required                                    |
| `completed_at`                | TIMESTAMPTZ                        | Nullable                                    |

---

# 13. Real-time and collaboration tables

## 13.1 `realtime_rooms`

Durable room metadata for presence or shared sessions.

| Column            | Type                       | Notes                                  |
| ----------------- | -------------------------- | -------------------------------------- |
| `id`              | UUID PK                    | Room ID                                |
| `organization_id` | UUID FK → organizations.id | Tenant                                 |
| `room_type`       | TEXT                       | `document`, `ai_session`, `collection` |
| `entity_id`       | UUID                       | Related document/session/collection    |
| `status`          | TEXT                       | `open`, `closed`                       |
| `created_at`      | TIMESTAMPTZ                | Required                               |
| `closed_at`       | TIMESTAMPTZ                | Nullable                               |

Recommended constraint:

```txt
UNIQUE(organization_id, room_type, entity_id)
```

Presence heartbeats can live in Redis or a real-time provider. Persist only durable room participation if needed.

---

## 13.2 `room_participants`

Tracks who joined a durable collaboration room.

| Column         | Type                        | Notes                           |
| -------------- | --------------------------- | ------------------------------- |
| `id`           | UUID PK                     | Participant row                 |
| `room_id`      | UUID FK → realtime_rooms.id | Room                            |
| `user_id`      | UUID FK → users.id          | User                            |
| `role`         | TEXT                        | `viewer`, `commenter`, `editor` |
| `joined_at`    | TIMESTAMPTZ                 | Required                        |
| `last_seen_at` | TIMESTAMPTZ                 | Nullable                        |
| `left_at`      | TIMESTAMPTZ                 | Nullable                        |

Recommended indexes:

```txt
INDEX(room_id, last_seen_at)
INDEX(user_id, joined_at)
```

---

## 13.3 `comments`

Comments on documents or AI sessions.

| Column              | Type                       | Notes                         |
| ------------------- | -------------------------- | ----------------------------- |
| `id`                | UUID PK                    | Comment ID                    |
| `organization_id`   | UUID FK → organizations.id | Tenant                        |
| `document_id`       | UUID FK → documents.id     | Nullable                      |
| `ai_session_id`     | UUID FK → ai_sessions.id   | Nullable                      |
| `parent_comment_id` | UUID FK → comments.id      | Threading                     |
| `author_user_id`    | UUID FK → users.id         | Author                        |
| `body`              | TEXT                       | Comment body                  |
| `status`            | TEXT                       | `active`, `deleted`, `hidden` |
| `created_at`        | TIMESTAMPTZ                | Required                      |
| `updated_at`        | TIMESTAMPTZ                | Required                      |
| `deleted_at`        | TIMESTAMPTZ                | Nullable                      |

Recommended constraint:

```txt
CHECK (
  document_id IS NOT NULL
  OR ai_session_id IS NOT NULL
)
```

---

# 14. Key relationship summary

| Relationship                                 | Cardinality | Meaning                                                     |
| -------------------------------------------- | ----------: | ----------------------------------------------------------- |
| `users` → `organization_memberships`         |         1:N | A user can belong to many orgs                              |
| `organizations` → `organization_memberships` |         1:N | An org has many members                                     |
| `organizations` → `subscriptions`            |         1:1 | An org has one current subscription state                   |
| `plans` → `subscriptions`                    |         1:N | Many orgs can use the same plan                             |
| `plans` → `plan_limits`                      |         1:N | A plan defines many limits                                  |
| `organizations` → `documents`                |         1:N | An org owns documents                                       |
| `documents` → `document_chunks`              |         1:N | A document is split into chunks                             |
| `document_collections` ↔ `documents`         |         M:N | Collections group documents                                 |
| `documents` → `jobs`                         | Logical 1:N | Processing jobs reference documents through job payload     |
| `jobs` → `job_attempts`                      |         1:N | A job has many attempts                                     |
| `ai_sessions` → `ai_messages`                |         1:N | A session contains messages                                 |
| `ai_messages` ↔ `document_chunks`            |         M:N | Assistant messages cite chunks through `ai_message_sources` |
| `organizations` → `usage_events`             |         1:N | Usage is tracked per org                                    |
| `organizations` → `usage_counters`           |         1:N | Usage is aggregated per org/period                          |
| `users` → `desktop_installations`            |         1:N | A user can install multiple desktop clients                 |
| `desktop_installations` → `desktop_sessions` |         1:N | A desktop app can create multiple sessions                  |
| `realtime_rooms` → `room_participants`       |         1:N | A room has many participants                                |
| `comments` → `comments`                      |         1:N | Comments can be threaded                                    |

---

# 15. Recommended enums

## `member_role`

```txt
owner
admin
member
```

## `membership_status`

```txt
active
invited
suspended
removed
```

## `subscription_status`

```txt
free
trialing
active
past_due
canceled
unpaid
incomplete
incomplete_expired
```

## `document_status`

```txt
uploaded
queued
processing
chunking
embedding
indexed
ready
failed
deleted
```

## `job_status`

```txt
pending
processing
retrying
completed
failed
dead_lettered
canceled
```

## `ai_message_role`

```txt
system
user
assistant
tool
```

## `ai_message_status`

```txt
streaming
completed
failed
canceled
```

## `usage_feature_key`

```txt
ai_messages
ai_input_tokens
ai_output_tokens
embedding_tokens
document_uploads
document_storage_bytes
desktop_uploads
team_members
```

## `source_type`

```txt
web_upload
desktop_upload
api
url
system
```

---

# 16. MVP schema cut

To avoid overbuilding, start with this MVP subset.

## MVP P0 tables

```txt
users
organizations
organization_memberships
plans
plan_limits
billing_customers
subscriptions
stripe_events
storage_objects
documents
document_chunks
jobs
job_attempts
prompt_versions
ai_sessions
ai_messages
ai_message_sources
usage_events
usage_counters
audit_logs
```

## P1 tables

```txt
invitations
document_collections
document_collection_items
ai_feedback
notifications
email_events
rate_limit_events
entitlement_checks
desktop_installations
desktop_sessions
desktop_uploads
```

## P2 tables

```txt
document_versions
realtime_rooms
room_participants
comments
feature_flag_overrides
```

---

# 17. Critical constraints to implement early

## Organization isolation

Every query for these tables should include `organization_id`:

```txt
documents
document_chunks
document_collections
ai_sessions
ai_messages
ai_message_sources
usage_events
usage_counters
jobs
audit_logs
desktop_sessions
desktop_uploads
comments
```

Example rule:

```txt
A user can read a document only if:
1. document.organization_id = selected_organization_id
2. user has active membership in selected_organization_id
3. document.deleted_at IS NULL
```

---

## Stripe webhook idempotency

```txt
stripe_events.stripe_event_id must be unique.
```

Processing flow:

```txt
Receive webhook
→ verify Stripe signature
→ insert stripe_events row
→ if insert conflicts, ignore duplicate
→ process subscription update
→ mark event processed
```

---

## Usage event idempotency

```txt
usage_events.idempotency_key should be unique.
```

Example keys:

```txt
ai_message:{message_id}:tokens
document:{document_id}:upload
embedding:{document_chunk_id}:{embedding_model}
```

---

## Job idempotency

```txt
jobs.idempotency_key should be unique.
```

Example keys:

```txt
process_document:{document_id}:{document_version_id}
send_document_ready_email:{document_id}:{user_id}
stripe_event:{stripe_event_id}
```

---

## AI source integrity

Each AI citation should preserve organization scope:

```txt
ai_message_sources.organization_id
ai_message_sources.ai_message_id
ai_message_sources.document_id
ai_message_sources.document_chunk_id
```

When querying cited chunks, validate all referenced rows belong to the same organization.

---

# 18. Suggested indexes

## Identity and tenancy

```txt
users(auth_provider, auth_provider_user_id) UNIQUE
users(email) UNIQUE
organizations(slug) UNIQUE
organization_memberships(user_id, organization_id) UNIQUE
organization_memberships(organization_id, role)
organization_memberships(organization_id, status)
```

## Billing

```txt
billing_customers(organization_id) UNIQUE
billing_customers(stripe_customer_id) UNIQUE
subscriptions(organization_id) UNIQUE
subscriptions(stripe_subscription_id) UNIQUE
subscriptions(status)
stripe_events(stripe_event_id) UNIQUE
plan_limits(plan_id, feature_key) UNIQUE
```

## Documents and RAG

```txt
storage_objects(bucket, object_key) UNIQUE
storage_objects(organization_id, created_at)
documents(organization_id, status)
documents(organization_id, created_at)
documents(created_by_user_id, created_at)
document_chunks(organization_id, document_id)
document_chunks(document_version_id, chunk_index) UNIQUE
document_chunks USING vector_index(embedding)
document_collection_items(collection_id, document_id) UNIQUE
```

## AI

```txt
ai_sessions(organization_id, created_at)
ai_sessions(created_by_user_id, created_at)
ai_messages(organization_id, session_id, created_at)
ai_message_sources(ai_message_id, document_chunk_id) UNIQUE
ai_feedback(ai_message_id, user_id) UNIQUE
```

## Usage and jobs

```txt
usage_events(organization_id, created_at)
usage_events(organization_id, feature_key, created_at)
usage_events(idempotency_key) UNIQUE
usage_counters(organization_id, feature_key, period_start, period_end) UNIQUE
jobs(status, run_after)
jobs(organization_id, status)
jobs(idempotency_key) UNIQUE
job_attempts(job_id, attempt_number) UNIQUE
```

## Desktop and real-time

```txt
desktop_installations(user_id, machine_fingerprint_hash) UNIQUE
desktop_sessions(user_id, organization_id, last_seen_at)
desktop_uploads(organization_id, created_at)
realtime_rooms(organization_id, room_type, entity_id) UNIQUE
room_participants(room_id, user_id)
comments(organization_id, document_id, created_at)
comments(organization_id, ai_session_id, created_at)
```

---

# 19. Suggested build order

## Phase 1: SaaS foundation

Build:

```txt
users
organizations
organization_memberships
audit_logs
```

Then verify:

```txt
User can sign up.
User can create org.
User can switch org.
User cannot access another org’s data.
```

---

## Phase 2: Billing and entitlements

Build:

```txt
plans
plan_limits
billing_customers
subscriptions
stripe_events
usage_events
usage_counters
```

Then verify:

```txt
Stripe webhook updates subscription state.
Duplicate webhook does not duplicate side effects.
Server can compute Free vs Pro entitlements.
Quota checks work before expensive actions.
```

---

## Phase 3: Documents and async jobs

Build:

```txt
storage_objects
documents
jobs
job_attempts
document_chunks
```

Then verify:

```txt
Upload creates document.
Upload creates processing job.
Job extracts text.
Job chunks document.
Job creates embeddings.
Document becomes ready.
Failures are visible and retryable.
```

---

## Phase 4: AI chat and RAG

Build:

```txt
prompt_versions
ai_sessions
ai_messages
ai_message_sources
ai_feedback
```

Then verify:

```txt
User asks question.
Server retrieves organization-scoped chunks.
AI response streams.
Message stores token usage.
Answer cites document chunks.
Usage event is recorded.
```

---

## Phase 5: Desktop companion

Build:

```txt
desktop_installations
desktop_sessions
desktop_uploads
entitlement_checks
```

Then verify:

```txt
Desktop app signs in.
Desktop app checks server entitlement.
Desktop app uploads file.
Desktop features remain locked without valid server-side entitlement.
```

---

## Phase 6: Collaboration and real-time

Build:

```txt
realtime_rooms
room_participants
comments
```

Then verify:

```txt
Document processing status updates live.
Users can see presence.
Users can comment on document or AI session.
Reconnect restores correct durable state.
```

---

# 20. Final ERD summary

The core of the database is this chain:

```txt
users
→ organization_memberships
→ organizations
→ subscriptions / plan_limits
→ documents
→ document_chunks
→ ai_sessions
→ ai_messages
→ ai_message_sources
→ usage_events
```

The most important production safeguards are:

```txt
organization_id on every business table
server-side membership checks
Stripe webhook idempotency
usage event idempotency
job idempotency
quota checks before AI calls
RAG retrieval filtered by organization_id
audit logs for sensitive actions
desktop entitlement verified server-side
```

This ERD gives you a production-shaped modular monolith schema: strong enough for a real AI SaaS MVP, but still simple enough to build incrementally.
