Below is a **sprint-by-sprint execution plan** for the AI Workspace SaaS described in the PRD. I’m assuming **2-week sprints**, a **solo or very small team**, and a build strategy that follows the roadmap’s recommended priority order: Postgres/data modeling, API/auth design, async jobs, observability, payments, caching/rate limiting, then cloud/performance architecture.

The plan is organized into:

```txt
Sprint 0: Project setup
Sprints 1–8: MVP
Sprints 9–14: AI/RAG hardening + admin operations
Sprints 15–18: Electron companion
Sprints 19–21: Real-time/collaboration
Sprints 22–24: Performance, launch, and architecture study
```

---

# Execution assumptions

## Sprint length

**2 weeks per sprint**

## MVP target

A user can:

```txt
Sign up
→ create an organization
→ upload a document
→ wait for processing
→ ask an AI question
→ receive an answer with sources
→ hit a quota
→ upgrade through Stripe
→ continue using the app
```

## Primary build strategy

Build a **modular monolith** first. Avoid microservices, Kubernetes, custom billing, custom auth, or complex infra until the product has real usage.

## Recommended default stack

```txt
Next.js
TypeScript
Tailwind
Postgres via Supabase
Supabase Auth
Stripe
Resend
Sentry
PostHog
Upstash Redis
Supabase Storage
Vercel AI SDK or direct AI provider SDK
pgvector first for vector search
Electron later
```

---

# Sprint 0: Product and engineering setup

## Sprint goal

Prepare the repository, workflows, project documentation, and implementation rules before writing product features.

## Main outcomes

By the end of this sprint, you should have a clean project skeleton and enough engineering discipline to support AI-assisted coding, tests, migrations, and deployment.

## Product scope

No end-user product value yet. This is foundation work.

## Engineering tasks

Create repo structure:

```txt
/apps/web
/apps/desktop
/packages/db
/packages/ui
/packages/config
/packages/auth
/packages/billing
/packages/ai
/packages/jobs
/docs/adr
/docs/runbooks
/docs/performance
```

Set up:

```txt
Next.js app
TypeScript
Tailwind
ESLint
Prettier
.env.example
README
GitHub repository
GitHub Actions CI
Deployment target
Database project
```

Add CI checks:

```txt
typecheck
lint
format check
unit test placeholder
migration validation placeholder
```

## Documentation tasks

Create:

```txt
/docs/adr/0001-stack-choice.md
/docs/adr/0002-repo-structure.md
/docs/adr/0003-modular-monolith-first.md
```

## Acceptance criteria

```txt
App deploys successfully.
CI runs on pull request.
README explains local setup.
.env.example lists required variables.
Empty dashboard route exists.
ADR folder exists.
```

## Definition of done

You can create a new branch, open a PR, pass CI, and deploy the empty app.

---

# Sprint 1: Auth, user model, and protected dashboard

## Sprint goal

Implement authentication and app-level user identity.

## Main outcomes

Users can sign up, sign in, sign out, and access a protected dashboard.

## User stories

```txt
As a visitor, I can sign up.
As a user, I can sign in.
As a signed-in user, I can access my dashboard.
As an unauthenticated visitor, I cannot access protected pages.
```

## Database work

Create:

```txt
users
```

Suggested fields:

```txt
id
auth_provider
auth_provider_user_id
email
display_name
avatar_url
status
last_seen_at
created_at
updated_at
deleted_at
```

## Engineering tasks

Implement:

```txt
Auth provider integration
App-level user sync
Protected layout
Dashboard shell
Session helper
Current user server helper
Sign out flow
```

Add auth utility:

```txt
requireUser()
getCurrentUser()
syncAuthUserToDatabase()
```

## Analytics and observability

Track:

```txt
user_signed_up
user_signed_in
dashboard_viewed
```

Add initial Sentry setup if easy, or leave full Sentry for Sprint 5.

## Tests

Add tests for:

```txt
Unauthenticated user cannot access dashboard.
Authenticated user can access dashboard.
User record is created or synced.
Disabled user cannot access app.
```

## Documentation tasks

Create:

```txt
/docs/adr/0004-authentication-model.md
```

## Acceptance criteria

```txt
User can sign up.
User can sign in.
User can sign out.
Protected dashboard works.
Unauthenticated access is blocked.
App-level user record exists.
```

---

# Sprint 2: Organizations, memberships, and tenant boundaries

## Sprint goal

Implement the multi-tenant SaaS foundation.

## Main outcomes

Users can create organizations, become owners, and access organization-scoped dashboard data.

## User stories

```txt
As a user, I can create an organization.
As an organization owner, I can view my workspace.
As a user, I cannot access another organization’s data.
```

## Database work

Create:

```txt
organizations
organization_memberships
audit_logs
```

Membership roles:

```txt
owner
admin
member
```

Membership statuses:

```txt
active
invited
suspended
removed
```

## Engineering tasks

Implement:

```txt
Organization creation
First organization onboarding
Organization switcher
Current organization resolver
Membership checks
Role checks
Protected org dashboard
Audit log helper
```

Add server helpers:

```txt
requireOrganization()
requireMembership()
requireRole(["owner", "admin"])
canAccessOrganization()
```

## UI tasks

Create:

```txt
Create organization page
Organization switcher
Dashboard home
Basic settings page
```

## Tests

Add tests for:

```txt
User creates org and becomes owner.
User cannot access org without membership.
Owner can access org settings.
Member cannot access owner-only action.
Audit log records org creation.
```

## Documentation tasks

Create:

```txt
/docs/adr/0005-multi-tenant-data-model.md
```

## Acceptance criteria

```txt
User can create organization.
Creator becomes owner.
Dashboard is organization-scoped.
Changing org ID in URL does not expose data.
Sensitive org actions create audit logs.
```

---

# Sprint 3: Plans, entitlements, and local free/pro gating

## Sprint goal

Build the plan and entitlement system before adding Stripe.

## Main outcomes

The app can determine what a user or organization is allowed to do based on plan state.

## User stories

```txt
As a free user, I have limited access.
As a pro user, I have higher limits.
As the system, I can check entitlement before allowing expensive actions.
```

## Database work

Create:

```txt
plans
plan_limits
subscriptions
usage_events
usage_counters
```

Seed plans:

```txt
free
pro_monthly
pro_yearly
```

Example limits:

```txt
free.ai_messages = 10/day
free.document_uploads = 3/day
free.max_file_size_mb = 5
pro.ai_messages = 500/billing_period
pro.document_uploads = 100/billing_period
pro.max_file_size_mb = 50
```

## Engineering tasks

Implement:

```txt
Plan seed script
Entitlement service
Quota service
Usage event writer
Usage counter updater
Server-side feature checks
```

Add helpers:

```txt
getOrganizationPlan()
getPlanLimits()
checkEntitlement(featureKey)
recordUsageEvent()
incrementUsageCounter()
```

## UI tasks

Create:

```txt
Usage page
Plan badge
Upgrade CTA placeholder
Quota remaining component
```

## Tests

Add tests for:

```txt
Free plan limits are enforced.
Pro plan limits are higher.
Quota checks are organization-scoped.
Usage event increments counter.
Usage idempotency key prevents duplicate usage.
```

## Documentation tasks

Create:

```txt
/docs/adr/0006-entitlements-and-usage-limits.md
```

## Acceptance criteria

```txt
Every organization has a plan.
Server can compute feature access.
Quota state is organization-scoped.
Usage page displays current limits.
Paid feature checks exist even before Stripe.
```

---

# Sprint 4: Stripe Checkout, subscriptions, and webhook idempotency

## Sprint goal

Implement paid subscription flow with reliable webhook-driven provisioning.

## Main outcomes

Users can upgrade to Pro, and the app updates subscription state through Stripe webhooks.

## User stories

```txt
As an owner, I can upgrade my organization.
As an owner, I can manage billing.
As the app, I do not trust client-side checkout redirects.
As the app, I can safely process duplicate webhooks.
```

## Database work

Create or finalize:

```txt
billing_customers
stripe_events
subscriptions
```

## Engineering tasks

Implement:

```txt
Stripe customer creation
Checkout session creation
Billing portal creation
Stripe webhook endpoint
Webhook signature verification
Webhook idempotency insert
Subscription sync from webhook
Plan mapping from Stripe price ID
```

Handle events:

```txt
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed
invoice.payment_succeeded
```

## UI tasks

Create:

```txt
Pricing page
Billing settings page
Upgrade button
Manage billing button
Subscription status display
```

## Tests

Add tests for:

```txt
Checkout session can be created by org owner.
Member cannot manage billing.
Duplicate webhook is ignored safely.
Subscription update changes plan.
Canceled subscription downgrades entitlement.
Past-due state is handled.
```

## Documentation tasks

Create:

```txt
/docs/adr/0007-billing-and-stripe-webhooks.md
/docs/runbooks/stripe-webhooks-failing.md
```

## Acceptance criteria

```txt
Owner can start checkout.
Stripe webhook updates subscription.
Duplicate webhook does not duplicate side effects.
Paid entitlement is server-driven.
Billing portal opens for existing customer.
```

---

# Sprint 5: Observability, analytics, and feature flags

## Sprint goal

Add production visibility before adding expensive AI workflows.

## Main outcomes

The app can answer: “Is it broken?” and “Are users activating?”

## User stories

```txt
As the builder, I can see app errors.
As the builder, I can see user activation events.
As the builder, I can roll out risky features behind flags.
```

## Engineering tasks

Implement:

```txt
Sentry frontend setup
Sentry server setup
Source maps
Error boundary
PostHog setup
PostHog identity/group tracking
Feature flag helper
Basic event tracking wrapper
```

## Product analytics events

Track:

```txt
user_signed_up
organization_created
dashboard_viewed
checkout_started
subscription_started
quota_exceeded
```

## Feature flags

Create:

```txt
document_upload_enabled
ai_chat_enabled
rag_v1_enabled
```

## UI tasks

Create:

```txt
Debug events page in development
Feature flag demo component
Error test route in development only
```

## Tests

Add tests for:

```txt
Analytics wrapper does not crash app.
Feature flag defaults safely.
Errors are captured in non-test environments.
```

## Documentation tasks

Create:

```txt
/docs/adr/0008-observability-and-product-analytics.md
```

## Acceptance criteria

```txt
Frontend errors appear in Sentry.
Server errors appear in Sentry.
PostHog receives core events.
At least one feature flag controls a visible feature.
User/org context is attached safely.
```

---

# Sprint 6: File storage and document upload MVP

## Sprint goal

Allow users to upload documents into organization-scoped storage.

## Main outcomes

Users can upload `.pdf`, `.txt`, or `.md` files and see them in a document list.

## User stories

```txt
As a user, I can upload a document.
As a user, I can see uploaded documents.
As a free user, I cannot exceed upload limits.
As the app, I validate file type and size before storage.
```

## Database work

Create:

```txt
storage_objects
documents
```

Document statuses:

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

## Engineering tasks

Implement:

```txt
Upload endpoint
Object storage integration
File type validation
File size validation
Upload entitlement check
Document row creation
Storage object row creation
Usage event for upload
```

## UI tasks

Create:

```txt
Documents page
Upload component
Upload progress state
Document list
Document status badge
```

## Tests

Add tests for:

```txt
Unsupported file is rejected.
Oversized file is rejected.
Upload limit is enforced.
Document belongs to organization.
User cannot upload into another org.
Upload records usage.
```

## Documentation tasks

Create:

```txt
/docs/adr/0009-file-storage-and-document-ownership.md
```

## Acceptance criteria

```txt
User can upload supported files.
Uploaded documents appear in list.
Files are stored in object storage.
Documents are organization-scoped.
Upload quota is enforced before accepting file.
```

---

# Sprint 7: Background jobs and document processing pipeline

## Sprint goal

Move document processing into an async job pipeline.

## Main outcomes

Uploading a document creates a processing job. The job extracts text, chunks content, and updates document status.

## User stories

```txt
As a user, I do not wait for heavy processing during upload.
As a user, I can see processing status.
As the system, failed jobs are visible and retryable.
```

## Database work

Create:

```txt
jobs
job_attempts
document_chunks
```

## Engineering tasks

Implement:

```txt
Job creation after upload
Job runner or job provider integration
Document text extraction
Markdown/text extraction
PDF extraction
Chunking service
Document status transitions
Job attempts
Retry with backoff
Dead-letter state
```

## Pipeline

```txt
uploaded
→ queued
→ processing
→ chunking
→ ready
```

Embedding can be added in Sprint 9 if needed.

## UI tasks

Update:

```txt
Document list status
Document detail page
Processing error state
Admin/dev failed job view
```

## Tests

Add tests for:

```txt
Upload creates job.
Job status changes correctly.
Job retry increments attempt count.
Duplicate job does not duplicate chunks.
Failed extraction marks document failed.
Deleted document does not continue processing.
```

## Documentation tasks

Create:

```txt
/docs/adr/0010-background-job-architecture.md
/docs/runbooks/queue-backlog.md
```

## Acceptance criteria

```txt
Upload request returns quickly.
Processing runs asynchronously.
Document status changes are persisted.
Failed jobs are visible.
Job execution is idempotent.
```

---

# Sprint 8: AI chat MVP with streaming, rate limits, and usage tracking

## Sprint goal

Implement the first AI feature without RAG: a quota-protected streaming AI chat.

## Main outcomes

Users can ask AI questions, receive streaming answers, and consume plan-based quota.

## User stories

```txt
As a user, I can ask an AI question.
As a user, I can see the answer stream in real time.
As a free user, I am blocked after reaching my limit.
As the app, I record token usage and cost.
```

## Database work

Create:

```txt
prompt_versions
ai_sessions
ai_messages
```

## Engineering tasks

Implement:

```txt
AI chat endpoint
Streaming response
Prompt version seed
AI session creation
User message storage
Assistant message storage
Token usage capture
Cost estimate capture
Quota check before AI call
Rate limiting with Upstash Redis
Friendly AI error handling
```

## UI tasks

Create:

```txt
AI chat page
Streaming response component
Chat history sidebar
Quota warning
Upgrade prompt on quota exceeded
```

## Analytics events

Track:

```txt
ai_chat_started
ai_chat_completed
ai_chat_failed
quota_exceeded
rate_limit_hit
```

## Tests

Add tests for:

```txt
Unauthenticated request is blocked.
Non-member cannot use org AI.
Quota exceeded blocks before model call.
Rate limit blocks repeated calls.
AI message is saved.
Usage is recorded.
Provider failure returns friendly error.
```

## Documentation tasks

Create:

```txt
/docs/adr/0011-ai-streaming-and-cost-control.md
/docs/runbooks/ai-provider-outage.md
```

## Acceptance criteria

```txt
User can stream AI answer.
Usage is recorded per org.
Quota is enforced before model call.
Rate limit works.
Errors are visible in Sentry.
```

## MVP checkpoint

At this point, the app has:

```txt
Auth
Organizations
Plans
Stripe
Entitlements
Observability
Document upload
Async processing skeleton
AI chat
Quotas
Rate limits
```

This is a strong internal MVP.

---

# Sprint 9: Embeddings and RAG retrieval v1

## Sprint goal

Connect uploaded documents to AI chat through retrieval.

## Main outcomes

Users can ask questions about their uploaded documents and receive answers grounded in retrieved chunks.

## User stories

```txt
As a user, I can ask a question about my documents.
As the app, I retrieve only chunks from the user’s organization.
As the app, I include retrieved context in the AI prompt.
```

## Database updates

Update:

```txt
document_chunks.embedding
document_chunks.embedding_model
```

Add if not present:

```txt
ai_message_sources
```

## Engineering tasks

Implement:

```txt
Embedding generation during document processing
Vector storage with pgvector
Vector similarity search
Organization-scoped retrieval
Document-scoped retrieval
Prompt assembly with retrieved context
Basic citation extraction
AI source linking
```

## UI tasks

Create:

```txt
Document Q&A tab
Source/citation display
Cited chunk preview
```

## Tests

Add tests for:

```txt
Embedding job stores vectors.
Retrieval filters by organization_id.
User cannot retrieve another org’s chunks.
AI answer links to source chunks.
No relevant context fallback works.
```

## Documentation tasks

Create:

```txt
/docs/adr/0012-rag-v1-with-pgvector.md
```

## Acceptance criteria

```txt
Processed document has chunks and embeddings.
Question retrieves relevant chunks.
Answer is grounded in retrieved context.
Sources are displayed.
Cross-org retrieval is impossible.
```

---

# Sprint 10: Document collections and scoped Q&A

## Sprint goal

Let users organize documents and scope AI sessions to a collection or document.

## Main outcomes

Users can group documents into collections and ask questions against selected scopes.

## User stories

```txt
As a user, I can create a collection.
As a user, I can add documents to a collection.
As a user, I can ask AI questions against a collection.
```

## Database work

Create:

```txt
document_collections
document_collection_items
```

## Engineering tasks

Implement:

```txt
Collection CRUD
Add/remove document from collection
Collection-scoped retrieval
Document-scoped retrieval
AI session scope
```

## UI tasks

Create:

```txt
Collections page
Collection detail page
Add to collection action
Scope selector in AI chat
```

## Tests

Add tests for:

```txt
Collection belongs to organization.
User cannot add document from another org.
Retrieval only uses selected collection.
Deleted document is excluded.
```

## Acceptance criteria

```txt
User can create collection.
User can add/remove documents.
AI chat can target all docs, one collection, or one document.
Retrieval scope is enforced server-side.
```

---

# Sprint 11: Admin/debug operations

## Sprint goal

Give yourself operational visibility into jobs, usage, webhooks, and failures.

## Main outcomes

The app becomes easier to operate as a solo developer.

## User stories

```txt
As an admin, I can see failed jobs.
As an admin, I can retry failed jobs.
As an admin, I can see usage by organization.
As an admin, I can inspect webhook failures.
```

## Engineering tasks

Implement:

```txt
Admin authorization
Failed jobs API
Retry job API
Usage summary API
Webhook event viewer
Recent AI failures viewer
Quota hit viewer
```

## UI tasks

Create admin pages:

```txt
/admin
/admin/jobs
/admin/usage
/admin/webhooks
/admin/ai-failures
/admin/quota
```

## Tests

Add tests for:

```txt
Non-admin cannot access admin pages.
Admin can retry failed job.
Retry creates new attempt.
Retry does not duplicate completed work.
Webhook failure is visible.
```

## Documentation tasks

Create:

```txt
/docs/runbooks/failed-document-processing.md
/docs/runbooks/stripe-webhook-replay.md
```

## Acceptance criteria

```txt
Failed jobs are visible.
Failed jobs can be retried safely.
Usage by org is visible.
Webhook processing state is visible.
Admin routes are protected.
```

---

# Sprint 12: Transactional emails and notifications

## Sprint goal

Add email and notification support for invite and document workflows.

## Main outcomes

Users can receive transactional emails for important events.

## User stories

```txt
As an admin, I can invite a teammate.
As an invited user, I receive an invite email.
As a user, I can receive a document-ready email.
```

## Database work

Create:

```txt
invitations
notifications
email_events
```

## Engineering tasks

Implement:

```txt
Resend integration
Email template system
Email idempotency
Invite creation
Invite acceptance
Document ready notification
Email event tracking
```

## UI tasks

Create:

```txt
Members page
Invite member modal
Invitation acceptance page
Notification preferences placeholder
```

## Tests

Add tests for:

```txt
Only admin/owner can invite.
Invite token is hashed.
Expired invite cannot be accepted.
Accepted invite creates membership.
Duplicate email job does not send twice.
Document-ready email is idempotent.
```

## Documentation tasks

Create:

```txt
/docs/adr/0013-transactional-email-and-invitations.md
```

## Acceptance criteria

```txt
Admin can invite teammate.
Invite email is sent.
Invite can be accepted.
Document-ready email can be sent.
Duplicate send is prevented.
```

---

# Sprint 13: AI feedback, prompt versioning, and evaluation set

## Sprint goal

Improve AI quality and create a basic feedback/evaluation loop.

## Main outcomes

Users can rate AI answers, and you can evaluate RAG quality against known questions.

## User stories

```txt
As a user, I can rate an AI answer.
As the builder, I can inspect bad answers.
As the builder, I can test whether retrieval is improving.
```

## Database work

Create:

```txt
ai_feedback
```

Refine:

```txt
prompt_versions
```

## Engineering tasks

Implement:

```txt
Thumbs up/down feedback
Feedback comments
Prompt version tracking per session
RAG evaluation seed set
Evaluation runner script
Retrieval logging
```

## UI tasks

Create:

```txt
Feedback buttons
Feedback comment modal
Admin AI feedback page
```

## Tests

Add tests for:

```txt
User can rate answer once.
Feedback is organization-scoped.
Prompt version is attached to AI session.
Evaluation runner produces report.
```

## Documentation tasks

Create:

```txt
/docs/adr/0014-ai-feedback-and-evaluation.md
/docs/performance/rag-eval-baseline.md
```

## Acceptance criteria

```txt
AI answers can be rated.
Bad answers can be reviewed.
Prompt versions are tracked.
Basic RAG eval report exists.
```

---

# Sprint 14: MVP hardening and private beta readiness

## Sprint goal

Stabilize the web MVP for private beta.

## Main outcomes

The product is ready for real test users.

## Product tasks

Review and polish:

```txt
Onboarding
Dashboard empty states
Document upload UX
AI chat UX
Pricing page
Billing settings
Usage page
Error states
Upgrade prompts
```

## Engineering tasks

Harden:

```txt
Authorization checks
Org isolation
Quota checks
Webhook handling
Job idempotency
AI error handling
File validation
Audit logs
```

## Testing tasks

Run full E2E flows:

```txt
Signup → org creation
Upload → process → ready
Ask AI → receive answer
Hit quota → upgrade
Stripe webhook → Pro active
Invite teammate → accept invite
Admin retries failed job
```

## Documentation tasks

Create:

```txt
/docs/beta-readiness-checklist.md
/docs/security/org-isolation-test-plan.md
```

## Acceptance criteria

```txt
Core E2E flow passes.
Critical Sentry errors are fixed.
Private beta checklist is complete.
Known limitations are documented.
```

## Release outcome

Private beta can begin after this sprint.

---

# Sprint 15: Electron shell and secure desktop foundation

## Sprint goal

Create the desktop companion app with a secure Electron architecture.

## Main outcomes

The Electron app launches, uses safe IPC, and can authenticate with the cloud app.

## User stories

```txt
As a desktop user, I can open the desktop app.
As the app, the renderer cannot access arbitrary Node APIs.
As a desktop user, I can sign in.
```

## Desktop engineering tasks

Create:

```txt
/apps/desktop
main process
preload script
renderer app
desktop auth flow
safe IPC bridge
```

Security settings:

```txt
contextIsolation: true
nodeIntegration: false
sandbox: true where practical
restricted navigation
CSP
validated IPC payloads
```

## Database work

Create:

```txt
desktop_installations
desktop_sessions
entitlement_checks
```

## UI tasks

Create:

```txt
Desktop welcome screen
Sign-in flow
Organization selector
Account/status page
```

## Tests

Add tests/checks for:

```txt
Renderer cannot access Node directly.
IPC payloads are validated.
Unauthenticated desktop session is blocked.
Desktop session is recorded.
```

## Documentation tasks

Create:

```txt
/docs/adr/0015-electron-security-model.md
```

## Acceptance criteria

```txt
Desktop app launches.
User can sign in.
Desktop session is recorded.
Renderer has no raw Node access.
IPC surface is minimal and typed.
```

---

# Sprint 16: Desktop file upload

## Sprint goal

Allow desktop users to upload local files into their cloud workspace.

## Main outcomes

The desktop app can upload files using the same organization-scoped document pipeline.

## User stories

```txt
As a desktop user, I can select a local file.
As a desktop user, I can upload it to my workspace.
As the app, desktop uploads obey the same server-side rules as web uploads.
```

## Database work

Create:

```txt
desktop_uploads
```

## Engineering tasks

Implement:

```txt
Native file picker
Safe IPC file selection
Upload request from desktop
Server-side entitlement check
Desktop upload tracking
Document creation from desktop upload
Processing job creation
```

## UI tasks

Create:

```txt
Desktop upload screen
Upload progress state
Recent uploads list
Processing status display
```

## Tests

Add tests for:

```txt
Desktop upload requires auth.
Desktop upload requires org membership.
Desktop upload respects file size/type limits.
Desktop upload creates document and job.
Local file path is not unnecessarily stored.
```

## Acceptance criteria

```txt
Desktop user can upload file.
Upload creates cloud document.
Document processing starts.
Server enforces quota and entitlement.
Desktop upload is tracked.
```

---

# Sprint 17: Desktop entitlement, offline grace, and local cache

## Sprint goal

Harden paid desktop access with server-side entitlement checks.

## Main outcomes

Desktop paid features cannot be unlocked by modifying local client state.

## User stories

```txt
As a Pro user, I can use desktop-only features.
As a Free user, I am blocked from Pro desktop features.
As a temporarily offline user, I get a limited grace period.
```

## Engineering tasks

Implement:

```txt
Desktop entitlement check endpoint
Cached entitlement snapshot
Offline grace period
Re-check on reconnect
Revoked subscription handling
Desktop session revocation
```

## UI tasks

Create:

```txt
Entitlement status banner
Offline grace warning
Subscription required screen
Reconnect state
```

## Tests

Add tests for:

```txt
Free org cannot use Pro desktop feature.
Pro org can use Pro desktop feature.
Cached entitlement expires.
Server denial overrides local cache.
Past-due subscription degrades access.
```

## Documentation tasks

Create:

```txt
/docs/adr/0016-desktop-entitlements-and-offline-grace.md
```

## Acceptance criteria

```txt
Desktop features are server-gated.
Local tampering does not unlock cloud actions.
Offline grace has clear expiration.
Reconnect refreshes entitlement state.
```

---

# Sprint 18: Desktop crash reporting and update pipeline

## Sprint goal

Make the desktop app operable in production.

## Main outcomes

The desktop app reports crashes and can be updated safely.

## Engineering tasks

Implement:

```txt
Sentry Electron
Desktop release version tracking
Crash reporting
Update check mechanism
Beta/stable channel concept
Update failure logging
Basic packaged build
```

## UI tasks

Create:

```txt
About screen
Version display
Check for updates action
Update error message
```

## Tests

Add tests/checks for:

```txt
Sentry captures desktop error.
App version is displayed.
Update failure is logged.
Packaged app launches.
```

## Documentation tasks

Create:

```txt
/docs/runbooks/desktop-update-failure.md
/docs/release/desktop-release-checklist.md
```

## Acceptance criteria

```txt
Desktop errors appear in Sentry.
Packaged desktop app runs.
Version is visible.
Update failure path is documented.
```

---

# Sprint 19: Real-time document status with SSE

## Sprint goal

Add live document processing status updates.

## Main outcomes

Users can see document status changes without refreshing.

## User stories

```txt
As a user, I can see when a document moves from queued to ready.
As a user, I do not need to refresh the page.
As the app, reconnect restores the latest durable status.
```

## Engineering tasks

Implement:

```txt
SSE endpoint or realtime provider subscription
Document status event publishing
Reconnect handling
Durable fallback fetch
Organization-scoped stream authorization
```

## UI tasks

Update:

```txt
Document list live status
Document detail live status
Processing progress component
Failure state with retry CTA
```

## Tests

Add tests for:

```txt
Only org members can subscribe.
Status update is delivered.
Reconnect fetches latest status.
Failed status is displayed correctly.
```

## Documentation tasks

Create:

```txt
/docs/adr/0017-realtime-document-status.md
```

## Acceptance criteria

```txt
Document status updates without refresh.
Unauthorized users cannot subscribe.
Reconnect restores correct state.
Refresh shows latest durable state.
```

---

# Sprint 20: Presence and shared AI session viewing

## Sprint goal

Add lightweight collaboration around AI sessions.

## Main outcomes

Team members can see who is viewing a shared AI session and optionally watch a session update live.

## User stories

```txt
As a team member, I can see who is viewing an AI session.
As a team member, I can watch a shared AI session.
As the app, presence is scoped by organization.
```

## Database work

Create:

```txt
realtime_rooms
room_participants
```

Presence itself may live in Redis or a real-time provider.

## Engineering tasks

Implement:

```txt
Room creation for AI sessions
Presence join/leave
Heartbeat
Viewer list
Shared AI session authorization
Reconnect cleanup
```

## UI tasks

Create:

```txt
Presence avatars
Shared AI session page
Live session updates
```

## Tests

Add tests for:

```txt
Non-member cannot join room.
Room belongs to organization.
Presence updates on join.
Stale participant is cleaned up.
Two users can view same session.
```

## Acceptance criteria

```txt
Presence works for shared AI sessions.
Room state is organization-scoped.
Reconnect behavior is acceptable.
Two browser windows show presence correctly.
```

---

# Sprint 21: Comments on documents or AI sessions

## Sprint goal

Add a simple durable collaboration feature.

## Main outcomes

Users can comment on documents or AI sessions.

## User stories

```txt
As a user, I can comment on a document.
As a user, I can reply to a comment.
As a user, I can see team discussion around an AI answer.
```

## Database work

Create:

```txt
comments
```

## Engineering tasks

Implement:

```txt
Create comment
Edit comment
Delete comment
Reply to comment
Comment authorization
Comment audit events
Optional live comment updates
```

## UI tasks

Create:

```txt
Comment thread component
Document comments panel
AI session comments panel
```

## Tests

Add tests for:

```txt
Only org members can comment.
User cannot comment on another org’s document.
Deleted comments are hidden.
Replies are threaded.
```

## Acceptance criteria

```txt
Users can comment on documents or AI sessions.
Comments are organization-scoped.
Basic threading works.
Deleted comments are handled.
```

---

# Sprint 22: Database performance, indexes, and load testing

## Sprint goal

Measure and improve the most important backend paths.

## Main outcomes

You understand the first likely bottlenecks and have documented query/index decisions.

## Engineering tasks

Measure:

```txt
Dashboard load
Document list
AI sessions list
Usage page
Admin usage dashboard
RAG retrieval
Job polling/status
```

Run:

```txt
EXPLAIN ANALYZE
index review
N+1 query review
pagination review
basic load test
```

Add or revise indexes:

```txt
documents(organization_id, status)
documents(organization_id, created_at)
ai_messages(organization_id, session_id, created_at)
usage_events(organization_id, feature_key, created_at)
jobs(status, run_after)
document_chunks vector index
```

## Testing tasks

Create load tests for:

```txt
Document list
AI chat request setup
Document status updates
Usage summary
Admin jobs page
```

## Documentation tasks

Create:

```txt
/docs/performance/query-plans.md
/docs/performance/load-test-report.md
```

## Acceptance criteria

```txt
Top queries have EXPLAIN notes.
Missing indexes are fixed.
Basic load test report exists.
Pagination exists for large lists.
Known bottlenecks are documented.
```

---

# Sprint 23: Caching, cost dashboard, and incident runbooks

## Sprint goal

Improve reliability and cost visibility.

## Main outcomes

The app can identify expensive usage and has runbooks for common incidents.

## Engineering tasks

Implement caching for one or more:

```txt
Organization entitlement
Plan limits
User membership lookup
Document metadata
```

Add cache policy:

```txt
cache key
TTL
invalidation trigger
fallback behavior
```

Build cost dashboard:

```txt
Tokens used today
Cost by organization
AI failures
Embedding cost
Quota hits
Top users by usage
```

## Documentation tasks

Create or finalize:

```txt
/docs/runbooks/ai-provider-outage.md
/docs/runbooks/database-slow.md
/docs/runbooks/queue-backlog.md
/docs/runbooks/stripe-webhooks-failing.md
/docs/runbooks/document-processing-failures.md
/docs/adr/0018-caching-and-cost-dashboard.md
```

## Tests

Add tests for:

```txt
Entitlement cache expires correctly.
Subscription update invalidates cache.
Cost dashboard queries are org/admin scoped.
Quota/cost aggregation is accurate enough.
```

## Acceptance criteria

```txt
At least one safe cache is implemented.
Cache invalidation is documented.
Cost dashboard shows usage by org.
Runbooks exist for critical incidents.
```

---

# Sprint 24: Launch readiness, open-source study, and public/private launch

## Sprint goal

Prepare for launch and complete the learning loop.

## Main outcomes

The product is ready for real users, and the builder has architecture notes from real systems.

## Product tasks

Finalize:

```txt
Landing page
Pricing page
Signup flow
Onboarding checklist
Support/contact form
Terms/privacy placeholders
Beta feedback flow
```

## Analytics tasks

Create dashboards for:

```txt
Visitor → signup
Signup → organization created
Organization created → document uploaded
Document uploaded → first AI answer
Free → paid
AI error rate
Document processing success rate
Cost per active org
```

## Open-source study tasks

Write two architecture studies:

```txt
/docs/studies/typescript-saas-study.md
/docs/studies/jobs-or-ai-system-study.md
```

Recommended study choices:

```txt
Dub or Cal.com for TypeScript SaaS
Trigger.dev for jobs
PostHog for analytics
Open WebUI for AI app patterns
```

## Launch checklist

Complete:

```txt
Security checklist
Billing checklist
Observability checklist
Backup checklist
Support checklist
Cost checklist
Runbook checklist
```

## Acceptance criteria

```txt
Landing page is live.
Signup works.
Core activation funnel is tracked.
Paid flow works in production mode.
Support channel exists.
Launch checklist is complete.
Architecture studies are written.
```

## Release outcome

Public launch or controlled private beta expansion.

---

# MVP sprint summary

The MVP is complete after **Sprint 14**.

|Sprint|Theme|Major deliverable|
|--:|---|---|
|0|Setup|Repo, CI, deployment, docs|
|1|Auth|Signup/signin/protected dashboard|
|2|Tenancy|Organizations and memberships|
|3|Entitlements|Plans, limits, usage counters|
|4|Billing|Stripe Checkout and webhooks|
|5|Observability|Sentry, PostHog, feature flags|
|6|Uploads|File storage and document records|
|7|Jobs|Async document processing|
|8|AI chat|Streaming AI with quotas|
|9|RAG|Embeddings, retrieval, citations|
|10|Collections|Scoped document Q&A|
|11|Admin|Jobs, usage, webhook visibility|
|12|Emails|Invites and notifications|
|13|AI quality|Feedback, prompt versions, evals|
|14|Hardening|Private beta readiness|

---

# Post-MVP sprint summary

|Sprint|Theme|Major deliverable|
|--:|---|---|
|15|Electron shell|Secure desktop foundation|
|16|Desktop upload|Local file upload to workspace|
|17|Desktop entitlements|Server-verified license checks|
|18|Desktop ops|Crash reporting and updates|
|19|Real-time status|Live document status updates|
|20|Presence|Shared AI session viewing|
|21|Comments|Simple collaboration layer|
|22|Performance|Query plans and load tests|
|23|Reliability/cost|Cache, runbooks, cost dashboard|
|24|Launch|Launch readiness and architecture study|

---

# Recommended sprint rhythm

Use the same operating system every sprint.

## Day 1: sprint planning

Create one issue per feature:

```txt
Problem
User story
Technical approach
Acceptance criteria
Tests required
Analytics required
Docs required
```

## Days 2–4: schema and backend first

For most features, implement in this order:

```txt
database migration
server service
authorization checks
tests
API/server action
```

## Days 5–7: UI integration

Then build:

```txt
page
form
loading state
empty state
error state
analytics events
```

## Days 8–9: hardening

Break the feature intentionally:

```txt
wrong org ID
expired session
duplicate request
failed provider
quota exceeded
slow network
partial failure
```

## Day 10: review and documentation

Finish:

```txt
tests
ADR update
runbook if needed
Sentry/PostHog check
cleanup
deployment
```

---

# Per-sprint definition of done

Every sprint should satisfy this checklist:

```txt
Feature works in deployed environment.
Authorization is enforced server-side.
Organization isolation is tested.
Relevant analytics events are tracked.
Important errors are visible in Sentry.
Database migrations are reviewed.
Tests pass in CI.
User-facing error states exist.
ADR or runbook is updated when architecture changes.
```

---

# Build order rule

For each new subsystem, use this pattern:

```txt
Data model
→ server service
→ authorization
→ tests
→ API/server action
→ UI
→ analytics
→ observability
→ docs
```

This prevents building attractive UI on top of weak backend boundaries.

---

# Highest-risk sprints

Pay extra attention to these:

## Sprint 4: Stripe

Risk:

```txt
Incorrect subscription state
Duplicate webhooks
Users unlocked incorrectly
```

Mitigation:

```txt
stripe_events unique constraint
webhook idempotency tests
manual subscription sync script
billing runbook
```

## Sprint 7: Jobs

Risk:

```txt
Duplicate processing
Lost jobs
Silent failures
```

Mitigation:

```txt
job idempotency keys
attempt logs
dead-letter state
admin retry UI
```

## Sprint 8–9: AI/RAG

Risk:

```txt
High LLM cost
Bad answers
Cross-org data leak
```

Mitigation:

```txt
quota before model call
rate limits
token/cost tracking
organization-scoped retrieval
citations
feedback loop
```

## Sprint 15–17: Electron

Risk:

```txt
Unsafe IPC
Local tampering
Paid feature bypass
```

Mitigation:

```txt
no Node in renderer
context isolation
validated IPC
server-side entitlement
offline grace expiration
```

---

# Best first milestone

Your first serious milestone is not “AI chat.” It is:

```txt
Sprint 1–5 complete:
Auth
Organizations
Entitlements
Stripe
Sentry
PostHog
```

That foundation makes every later AI, document, desktop, and collaboration feature safer to build.