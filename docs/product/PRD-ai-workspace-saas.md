**Document status:** Draft v1  
**Date:** May 3, 2026  
**Primary user:** Solo/front-end-leaning software engineer building production-grade indie AI apps  
**Product type:** Paid AI SaaS web app with optional Electron desktop companion  
**Source basis:** This PRD is based on the architecture roadmap and learning plan that prioritize product architecture, Postgres/data modeling, auth, payments, async jobs, AI cost control, observability, Electron hardening, real-time systems, and launch instrumentation.

---

# 1. Product summary

## 1.1 Product name

**AI Workspace**

## 1.2 One-line description

AI Workspace is a paid SaaS app where individuals and small teams can upload documents, ask AI questions over their knowledge base, generate summaries asynchronously, track usage, and collaborate around AI-assisted work.

## 1.3 Product concept

The product is both:

1. A real AI SaaS product that could be launched.
    
2. A structured learning vehicle for building production-grade full-stack architecture skills.
    

The app starts as a web SaaS product and later expands into an Electron desktop companion. Over time, it adds async AI workflows, billing, quotas, RAG, observability, real-time status updates, collaboration, and system-design hardening.

## 1.4 Target outcome

By building this product, the builder should gain practical skill in:

- Multi-tenant SaaS architecture.
    
- Postgres schema design.
    
- Auth, authorization, and entitlements.
    
- Stripe Billing and webhook reliability.
    
- AI streaming and RAG.
    
- Async jobs and retries.
    
- Rate limiting and quotas.
    
- Sentry and PostHog instrumentation.
    
- Electron security.
    
- Real-time collaboration.
    
- Performance, caching, and incident response.
    

---

# 2. Problem statement

Many AI productivity tools are useful but shallow. Users can chat with a model, but they often lack:

- Team-level knowledge organization.
    
- Reliable document ingestion.
    
- Clear source citations.
    
- Usage limits and cost transparency.
    
- Subscription-aware access control.
    
- Async processing for heavier AI tasks.
    
- Real-time processing status.
    
- Desktop workflows for local files.
    
- Observability and reliability expected from paid software.
    

For the builder, the broader problem is that “learning backend” is too vague. The product needs to force practice in the exact backend and product-architecture skills required to ship scalable indie AI apps.

---

# 3. Goals and non-goals

## 3.1 Product goals

### Goal 1: Build a production-shaped SaaS foundation

The app must include authentication, organizations, roles, billing, entitlements, usage tracking, error monitoring, analytics, and deployment.

### Goal 2: Provide useful AI document workflows

Users should be able to upload documents, wait for background processing, and ask AI questions that return useful answers with source references.

### Goal 3: Protect cost and reliability

The app must prevent uncontrolled AI usage through rate limits, plan quotas, usage tracking, and server-side enforcement.

### Goal 4: Support team collaboration over time

Organizations should be able to invite members, share document collections, view AI sessions, and eventually collaborate in real time.

### Goal 5: Serve as a learning capstone

Every major subsystem must produce a learning artifact: architecture decision record, tests, acceptance criteria, failure-mode notes, or runbook.

---

## 3.2 Business goals

- Launch a paid AI SaaS MVP.
    
- Validate whether users will upload documents and repeatedly ask questions.
    
- Convert a percentage of active free users to paid plans.
    
- Learn which AI workflows create retention.
    
- Build a reusable SaaS starter for future products.
    

---

## 3.3 Learning goals

The builder should finish the project able to confidently explain and implement:

|Learning area|Demonstrated through|
|---|---|
|Data modeling|Org-scoped Postgres schema, indexes, migrations, audit logs|
|Auth/authz|Protected routes, roles, permissions, server-side access checks|
|Entitlements|Stripe-driven subscription status and plan-based limits|
|Async jobs|Document processing pipeline with retries and job status|
|AI systems|Streaming chat, RAG, citations, token tracking|
|Cost control|Usage events, quotas, LLM cost dashboard|
|Observability|Sentry errors/traces, PostHog funnels/events|
|Electron|Secure IPC, context isolation, server-verified license checks|
|Real-time|Processing status, presence, shared AI session updates|
|Reliability|Runbooks, idempotency, retries, load tests|

---

## 3.4 Non-goals

The first version should **not** include:

- Kubernetes.
    
- Microservices.
    
- Multi-region infrastructure.
    
- Custom authentication.
    
- Custom billing engine.
    
- Full enterprise compliance.
    
- Self-hosted infrastructure.
    
- Complex marketplace payments.
    
- Advanced WebRTC media features.
    
- Full Google Docs-style collaborative editing.
    

These can be studied later, but they are not required for the first production-shaped version.

---

# 4. Target users and personas

## 4.1 Persona A: Solo founder / indie hacker

**Profile:** Builds small products, manages lots of documents, wants fast AI assistance.  
**Needs:**

- Upload notes, PDFs, transcripts, product docs.
    
- Ask AI questions across files.
    
- Keep costs predictable.
    
- Use a simple dashboard.
    
- Possibly use a desktop uploader.
    

**Success moment:** Uploads a folder of documents and receives accurate answers with cited sources.

---

## 4.2 Persona B: Small team operator

**Profile:** Works in a small startup, agency, research group, or consulting team.  
**Needs:**

- Shared organization workspace.
    
- Team members and roles.
    
- Document collections.
    
- Shared AI answers.
    
- Billing under one organization.
    
- Basic auditability.
    

**Success moment:** Invites a teammate, shares a document set, and both can use AI over the same knowledge base.

---

## 4.3 Persona C: Power user / paid subscriber

**Profile:** Uses the app frequently and is willing to pay for higher limits.  
**Needs:**

- Higher AI usage limits.
    
- Faster processing.
    
- More uploads.
    
- Usage visibility.
    
- Reliable performance.
    
- Desktop workflow.
    

**Success moment:** Understands what their plan includes and trusts that the app will not silently lose work.

---

## 4.4 Persona D: Builder / learner

**Profile:** The person building the app.  
**Needs:**

- Skill-building structure.
    
- Clear implementation milestones.
    
- Architecture notes.
    
- Testable requirements.
    
- Production-like failure scenarios.
    

**Success moment:** Can explain and defend each subsystem’s architecture and reuse the foundation for future products.

---

# 5. Product principles

## 5.1 Server owns trust

The client may display state, but the server decides:

- Who the user is.
    
- Which organization they belong to.
    
- What role they have.
    
- What plan they are on.
    
- Which documents they can access.
    
- Whether they can use an AI feature.
    
- Whether they exceeded quota.
    

## 5.2 Async by default for expensive work

The app should avoid blocking user-facing requests for:

- PDF parsing.
    
- Embedding generation.
    
- Document indexing.
    
- Summaries.
    
- Emails.
    
- Webhook side effects.
    
- Long AI workflows.
    

## 5.3 Every expensive action is measured

The app must record usage for:

- AI messages.
    
- Tokens.
    
- Document uploads.
    
- Embedding generation.
    
- Background job attempts.
    
- Failed generations.
    
- Quota hits.
    

## 5.4 Managed services first, primitives understood

Use managed services to ship quickly, but model the underlying concepts clearly: database state, queues, retries, caches, rate limits, object storage, and observability.

## 5.5 Build small, harden deliberately

Each feature should go through:

```txt
Concept → sandbox → product integration → test → monitor → document
```

---

# 6. Product scope

## 6.1 MVP scope

The MVP is a production-shaped AI SaaS web app.

### MVP includes

- User signup/signin.
    
- Organization creation.
    
- Organization-scoped documents.
    
- Basic roles: owner, admin, member.
    
- Stripe Free and Pro plans.
    
- Server-side entitlement checks.
    
- Document upload.
    
- Background document processing.
    
- AI chat over processed documents.
    
- Streaming AI responses.
    
- Usage tracking.
    
- Quotas and rate limits.
    
- Sentry error tracking.
    
- PostHog analytics.
    
- Transactional emails.
    
- Admin/debug dashboard.
    
- Basic architecture documentation.
    

### MVP excludes

- Electron app.
    
- Real-time collaboration.
    
- Advanced team permissions.
    
- Full-text annotation.
    
- Complex document editing.
    
- Enterprise SSO.
    
- Mobile app.
    
- Marketplace billing.
    
- Multi-region scaling.
    

---

## 6.2 Beta scope

The beta adds desktop, stronger async workflows, better AI quality, and real-time status.

### Beta includes

- Electron desktop companion.
    
- Secure IPC.
    
- Server-side license checks.
    
- Local file upload from desktop.
    
- Auto-update pipeline.
    
- Real-time document processing status.
    
- Admin retry UI for failed jobs.
    
- Improved RAG citations.
    
- Cost dashboard.
    
- Query performance notes.
    
- Runbooks.
    

---

## 6.3 V1 launch scope

V1 focuses on a complete paid product loop.

### V1 includes

- Public landing page.
    
- Free plan.
    
- Paid Pro plan.
    
- Onboarding flow.
    
- Document Q&A.
    
- Usage visibility.
    
- Billing portal.
    
- Support/contact flow.
    
- Activation analytics.
    
- Retention analytics.
    
- Production runbooks.
    
- Launch metrics dashboard.
    

---

# 7. Core user journeys

## 7.1 Signup and organization creation

### User story

As a new user, I want to create an account and workspace so I can start uploading documents.

### Flow

```txt
Visitor lands on marketing page
→ clicks “Get started”
→ signs up
→ verifies email if required
→ creates organization
→ lands on onboarding checklist
→ uploads first document
```

### Acceptance criteria

- User cannot access dashboard without authentication.
    
- User must belong to an organization before uploading documents.
    
- First organization creator becomes owner.
    
- Organization ID is used to scope all app resources.
    
- Signup and org creation events are tracked.
    

---

## 7.2 Invite teammate

### User story

As an organization admin, I want to invite a teammate so we can share documents and AI answers.

### Flow

```txt
Admin opens Members page
→ enters teammate email
→ selects role
→ sends invite
→ invite email sent
→ teammate accepts
→ teammate joins organization
```

### Acceptance criteria

- Only owner/admin can invite members.
    
- Invite has an expiration time.
    
- Invite cannot be reused after acceptance.
    
- Invitee is added to correct organization.
    
- Invitation events are tracked.
    
- Unauthorized invite attempts are rejected server-side.
    

---

## 7.3 Upgrade to Pro

### User story

As a user who reached the free limit, I want to upgrade so I can continue using AI features.

### Flow

```txt
User hits quota
→ sees upgrade prompt
→ opens pricing page
→ starts Stripe Checkout
→ completes payment
→ Stripe webhook updates subscription
→ Pro entitlement becomes active
→ user can continue
```

### Acceptance criteria

- Checkout completion alone does not unlock Pro.
    
- Stripe webhook updates subscription status.
    
- Webhook handler is idempotent.
    
- Duplicate webhook events do not duplicate records.
    
- User sees current plan in settings.
    
- Billing portal link is available for paid users.
    
- Subscription events are tracked.
    

---

## 7.4 Upload document

### User story

As a user, I want to upload documents so I can ask AI questions about them.

### Flow

```txt
User opens Documents page
→ uploads file
→ file stored in object storage
→ document row created
→ processing job enqueued
→ document status becomes queued
→ background worker extracts text
→ chunks document
→ generates embeddings
→ indexes chunks
→ status becomes ready
```

### Acceptance criteria

- User can upload supported file types only.
    
- File belongs to an organization.
    
- User cannot upload into another organization.
    
- Upload request returns quickly.
    
- Processing happens asynchronously.
    
- Document status is visible.
    
- Failed processing state is visible.
    
- Admin can inspect failed jobs.
    
- Upload and processing events are tracked.
    

---

## 7.5 Ask AI question over documents

### User story

As a user, I want to ask a question about my documents and receive a useful answer with source references.

### Flow

```txt
User selects document collection
→ enters question
→ server checks auth, role, entitlement, quota, rate limit
→ relevant chunks retrieved
→ LLM response streams to UI
→ answer saved
→ token usage recorded
→ citations displayed
```

### Acceptance criteria

- AI endpoint is protected server-side.
    
- User cannot query documents outside their organization.
    
- Free and Pro quotas are enforced.
    
- Response streams progressively.
    
- Token usage is recorded.
    
- Answer includes source references when retrieval is used.
    
- Failed AI requests show friendly errors.
    
- AI failures are logged to Sentry.
    
- AI events are tracked in PostHog.
    

---

## 7.6 View usage and quota

### User story

As a user, I want to know how much usage I have left so I understand my plan limits.

### Flow

```txt
User opens Usage page
→ sees AI messages used
→ sees document uploads used
→ sees current billing period
→ sees remaining quota
→ sees upgrade prompt if near limit
```

### Acceptance criteria

- Usage is scoped to organization.
    
- Usage resets according to billing period rules.
    
- Free and Pro plans show different limits.
    
- Quota checks use server-side data.
    
- UI cannot override quota state.
    
- Quota-exceeded events are tracked.
    

---

## 7.7 Desktop upload

### User story

As a desktop user, I want to upload local files from my computer into my AI workspace.

### Flow

```txt
User opens Electron app
→ signs in
→ selects organization
→ chooses local file
→ app requests upload URL or upload endpoint
→ file uploads to cloud
→ processing status syncs back
```

### Acceptance criteria

- Renderer cannot access arbitrary Node APIs.
    
- Main process exposes only safe APIs.
    
- User session is validated with server.
    
- Upload uses organization-scoped permissions.
    
- Paid desktop-only features require server-side entitlement.
    
- Desktop app reports crashes and update errors.
    

---

## 7.8 Real-time processing status

### User story

As a user, I want document status to update automatically so I know when AI search is ready.

### Flow

```txt
Document uploaded
→ status is queued
→ status changes to processing
→ status changes to indexing
→ status changes to ready or failed
→ UI updates without refresh
```

### Acceptance criteria

- User sees live status updates.
    
- Refreshing page restores correct status.
    
- Reconnect recovers latest state.
    
- Status updates are organization-scoped.
    
- Failed state includes next action.
    

---

# 8. Functional requirements

## 8.1 Authentication and user accounts

### Priority

P0 for MVP.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|AUTH-001|Users can sign up with email/password or hosted auth provider.|P0|
|AUTH-002|Users can sign in and sign out.|P0|
|AUTH-003|Unauthenticated users are redirected away from protected pages.|P0|
|AUTH-004|Authenticated users have a server-side user record.|P0|
|AUTH-005|User session is available to server routes/actions.|P0|
|AUTH-006|Deleted or disabled users cannot access APIs.|P1|
|AUTH-007|Support MFA or provider-level advanced protection.|P2|

### Learning deliverable

Create:

```txt
/docs/adr/0002-authentication-model.md
```

Must explain:

- Auth provider choice.
    
- Session model.
    
- How server-side user identity is resolved.
    
- What is trusted and not trusted.
    

---

## 8.2 Organizations and membership

### Priority

P0 for MVP.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|ORG-001|User can create an organization.|P0|
|ORG-002|First creator becomes organization owner.|P0|
|ORG-003|User can switch between organizations.|P0|
|ORG-004|Resources are scoped by organization ID.|P0|
|ORG-005|Organization has members.|P0|
|ORG-006|Roles include owner, admin, and member.|P0|
|ORG-007|Admins can invite users.|P1|
|ORG-008|Owners can remove members.|P1|
|ORG-009|Owners can transfer ownership.|P2|

### Acceptance criteria

- A user cannot access another organization by changing URL params.
    
- All document, usage, subscription, and audit data includes organization ownership.
    
- Server-side authorization is required for every org-scoped action.
    

---

## 8.3 Permissions and authorization

### Priority

P0 for MVP.

### Role model

|Action|Owner|Admin|Member|
|---|--:|--:|--:|
|View dashboard|Yes|Yes|Yes|
|Upload documents|Yes|Yes|Yes|
|Ask AI questions|Yes|Yes|Yes|
|Invite members|Yes|Yes|No|
|Remove members|Yes|Yes|No|
|Manage billing|Yes|No/P1|No|
|Delete organization|Yes|No|No|
|Retry failed jobs|Yes|Admin/P1|No|
|View audit log|Yes|Admin/P1|No|

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|AUTHZ-001|Every protected API checks authenticated user.|P0|
|AUTHZ-002|Every org-scoped API checks membership.|P0|
|AUTHZ-003|Admin-only APIs check role.|P0|
|AUTHZ-004|Billing actions require owner role.|P0|
|AUTHZ-005|Unauthorized requests return safe errors.|P0|
|AUTHZ-006|Authorization failures are logged.|P1|
|AUTHZ-007|Sensitive authorization failures create audit log entries.|P1|

---

## 8.4 Billing and subscriptions

### Priority

P0 for MVP.

### Plans

|Plan|Price|Target|Limits|
|---|--:|---|---|
|Free|$0|Trial users|Limited AI messages and uploads|
|Pro|TBD|Power users/small teams|Higher AI and upload limits|
|Team|Future|Multi-user teams|More seats, shared quotas, admin controls|

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|BILL-001|User can view current plan.|P0|
|BILL-002|User can start Stripe Checkout.|P0|
|BILL-003|App stores Stripe customer ID.|P0|
|BILL-004|App stores subscription status.|P0|
|BILL-005|App processes Stripe webhooks.|P0|
|BILL-006|Webhook events are idempotent.|P0|
|BILL-007|User can open Stripe customer portal.|P0|
|BILL-008|Canceled subscription updates entitlement.|P0|
|BILL-009|Failed payment places org into degraded state.|P1|
|BILL-010|Plan changes update quota limits.|P1|
|BILL-011|Invoice/payment emails are handled by Stripe or email provider.|P1|

### Subscription statuses

The app should explicitly handle:

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

### Acceptance criteria

- Paid features are unlocked by server-side subscription state, not by client redirect.
    
- Duplicate Stripe webhooks do not duplicate side effects.
    
- Subscription status changes are visible in the app.
    
- Billing-related events are captured in analytics.
    

### Learning deliverable

Create:

```txt
/docs/adr/0003-billing-and-entitlements.md
/docs/runbooks/stripe-webhooks-failing.md
```

---

## 8.5 Entitlements and plan limits

### Priority

P0 for MVP.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|ENT-001|Server can compute current organization entitlement.|P0|
|ENT-002|Free plan has AI message limit.|P0|
|ENT-003|Free plan has document upload limit.|P0|
|ENT-004|Pro plan has higher limits.|P0|
|ENT-005|AI endpoint checks entitlement before model call.|P0|
|ENT-006|Upload endpoint checks entitlement before accepting file.|P0|
|ENT-007|Desktop app verifies entitlement server-side.|P1|
|ENT-008|Entitlement can be cached with safe TTL.|P2|

### Example limits

|Feature|Free|Pro|
|---|--:|--:|
|AI messages|10/day|500/month|
|Document uploads|3/day|100/month|
|File size|5 MB|50 MB|
|Team members|1|5|
|Desktop companion|No/P1|Yes|

Final limits should be adjusted after real usage data.

---

## 8.6 Document management

### Priority

P0 for MVP.

### Supported file types

MVP:

```txt
.pdf
.txt
.md
```

Future:

```txt
.docx
.csv
.html
.web transcript
.audio transcript
```

### Document statuses

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

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|DOC-001|User can upload supported document.|P0|
|DOC-002|File is stored in object storage.|P0|
|DOC-003|Document metadata is stored in Postgres.|P0|
|DOC-004|Document belongs to organization.|P0|
|DOC-005|User can view document list.|P0|
|DOC-006|User can view processing status.|P0|
|DOC-007|User can delete document.|P1|
|DOC-008|Deleted document is excluded from retrieval.|P1|
|DOC-009|User can group documents into collections.|P1|
|DOC-010|User can retry failed processing.|P1|
|DOC-011|User can see extracted text preview.|P2|

### Acceptance criteria

- Upload is rejected when plan limit is exceeded.
    
- Upload is rejected when file type is unsupported.
    
- Upload is rejected when user lacks organization access.
    
- Uploaded document immediately appears with processing status.
    
- Processing failure does not crash the app.
    

---

## 8.7 Async document processing

### Priority

P0 for MVP.

### Pipeline

```txt
Upload file
→ create document row
→ enqueue processing job
→ extract text
→ split into chunks
→ generate embeddings
→ store chunks
→ mark document ready
→ send optional notification
```

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|JOB-001|Upload creates background job.|P0|
|JOB-002|Job status is stored in database.|P0|
|JOB-003|Job retries on transient failure.|P0|
|JOB-004|Job has max retry count.|P0|
|JOB-005|Failed job is visible to admin/debug UI.|P0|
|JOB-006|Job execution is idempotent.|P0|
|JOB-007|Admin can retry failed job.|P1|
|JOB-008|Dead-letter state is tracked.|P1|
|JOB-009|Queue depth is monitored.|P1|
|JOB-010|Long-running jobs expose progress updates.|P2|

### Failure modes to handle

- File missing from object storage.
    
- PDF extraction fails.
    
- Embedding provider fails.
    
- Job runs twice.
    
- Job partially completes.
    
- Database write fails after embedding call.
    
- User deletes document while job is running.
    
- Organization subscription becomes invalid during job.
    

### Learning deliverable

Create:

```txt
/docs/adr/0004-background-job-architecture.md
/docs/runbooks/queue-backlog.md
```

---

## 8.8 AI chat and streaming

### Priority

P0 for MVP.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|AI-001|User can submit a question.|P0|
|AI-002|Server validates auth, org, entitlement, quota, and rate limit.|P0|
|AI-003|Response streams to the UI.|P0|
|AI-004|Chat message is saved.|P0|
|AI-005|Token usage is recorded.|P0|
|AI-006|AI errors show user-friendly fallback.|P0|
|AI-007|AI errors are logged with context.|P0|
|AI-008|User can view previous AI sessions.|P1|
|AI-009|User can provide thumbs up/down feedback.|P1|
|AI-010|Prompt versions are tracked.|P1|
|AI-011|AI responses can be regenerated.|P2|

### Acceptance criteria

- AI request is denied before model call when quota is exceeded.
    
- Stream interruption does not corrupt saved chat state.
    
- Usage is recorded even when model response fails after partial generation.
    
- Sensitive secrets are never exposed to client.
    

---

## 8.9 RAG and citations

### Priority

P0/P1.

MVP should include basic retrieval. Better citation quality can be improved in beta.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|RAG-001|Document text is chunked.|P0|
|RAG-002|Chunks are stored with document metadata.|P0|
|RAG-003|Embeddings are generated for chunks.|P0|
|RAG-004|Question retrieves relevant chunks.|P0|
|RAG-005|AI response includes source references.|P0|
|RAG-006|Retrieval is filtered by organization.|P0|
|RAG-007|Retrieval is filtered by selected document/collection.|P1|
|RAG-008|User can inspect cited chunks.|P1|
|RAG-009|App tracks answer feedback.|P1|
|RAG-010|App includes evaluation set for common questions.|P2|

### Retrieval metadata

Each chunk should include:

```txt
chunk_id
document_id
organization_id
text
embedding
page_number
section_title
token_count
created_at
```

### Acceptance criteria

- Retrieval cannot cross organization boundaries.
    
- Response cites at least one source when relevant chunks are used.
    
- If retrieval returns poor/no context, response should say it cannot find enough information.
    
- RAG query latency is tracked.
    

---

## 8.10 Rate limiting and quotas

### Priority

P0 for MVP.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|LIMIT-001|AI endpoint has per-user rate limit.|P0|
|LIMIT-002|AI endpoint has per-organization quota.|P0|
|LIMIT-003|Upload endpoint has per-organization quota.|P0|
|LIMIT-004|Quota is based on plan.|P0|
|LIMIT-005|Quota failures show upgrade path.|P0|
|LIMIT-006|Quota events are tracked.|P0|
|LIMIT-007|Suspicious usage can be denied.|P1|
|LIMIT-008|Admin can view top usage by org/user.|P1|

### Acceptance criteria

- Multiple browser tabs cannot bypass limits.
    
- Direct API calls cannot bypass limits.
    
- Quota state is consistent enough for billing protection.
    
- Quota checks happen before expensive provider calls.
    

---

## 8.11 Usage and cost tracking

### Priority

P0/P1.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|COST-001|Record AI request usage.|P0|
|COST-002|Record token usage when available.|P0|
|COST-003|Record document upload usage.|P0|
|COST-004|Record embedding usage.|P1|
|COST-005|Estimate cost by organization.|P1|
|COST-006|Internal dashboard shows top-cost organizations.|P1|
|COST-007|Internal dashboard shows failed generations.|P1|
|COST-008|Cost alerts trigger when usage spikes.|P2|

### Usage event examples

```txt
ai_chat_started
ai_chat_completed
ai_chat_failed
ai_tokens_used
document_uploaded
document_processing_started
document_processing_completed
embedding_generated
quota_exceeded
rate_limit_hit
```

---

## 8.12 Product analytics

### Priority

P0 for MVP.

### Required events

```txt
user_signed_up
organization_created
onboarding_started
onboarding_completed
document_uploaded
document_processing_completed
document_processing_failed
ai_chat_started
ai_chat_completed
ai_chat_failed
quota_exceeded
checkout_started
subscription_started
subscription_canceled
invite_sent
invite_accepted
desktop_app_connected
```

### Funnel metrics

|Funnel step|Event|
|---|---|
|Visitor lands|page_view|
|User signs up|user_signed_up|
|User creates org|organization_created|
|User uploads document|document_uploaded|
|Document becomes ready|document_processing_completed|
|User asks AI question|ai_chat_started|
|User receives answer|ai_chat_completed|
|User returns|second_session|
|User upgrades|subscription_started|

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|ANA-001|Track activation funnel.|P0|
|ANA-002|Track AI usage.|P0|
|ANA-003|Track quota hits.|P0|
|ANA-004|Track checkout starts and completions.|P0|
|ANA-005|Track feature usage by plan.|P1|
|ANA-006|Add one feature flag.|P1|
|ANA-007|Use feature flag for beta AI/document feature.|P1|

---

## 8.13 Error tracking and observability

### Priority

P0 for MVP.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|OBS-001|Capture frontend errors.|P0|
|OBS-002|Capture backend/API errors.|P0|
|OBS-003|Include user and organization context when safe.|P0|
|OBS-004|Capture AI provider failures.|P0|
|OBS-005|Capture job failures.|P0|
|OBS-006|Capture Stripe webhook failures.|P0|
|OBS-007|Source maps are configured.|P0|
|OBS-008|Performance traces exist for key endpoints.|P1|
|OBS-009|Session replay enabled for debugging.|P1|
|OBS-010|Alerts configured for critical failures.|P1|

### Key alerts

```txt
Stripe webhook failure rate above threshold
AI endpoint error rate spike
Document job failure spike
Queue backlog growing
Database latency spike
Checkout conversion drop
```

---

## 8.14 Transactional emails

### Priority

P0/P1.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|EMAIL-001|Send invite email.|P1|
|EMAIL-002|Send document processed notification.|P1|
|EMAIL-003|Send failed processing notification for important failures.|P2|
|EMAIL-004|Send onboarding nudge.|P2|
|EMAIL-005|Email sending is async and idempotent.|P1|

### Email templates

```txt
invite-member
document-ready
document-failed
welcome
usage-limit-warning
```

---

## 8.15 Admin/debug dashboard

### Priority

P1.

### Purpose

The admin/debug dashboard is not for end users. It helps the solo builder operate the product.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|ADMIN-001|View organizations.|P1|
|ADMIN-002|View users.|P1|
|ADMIN-003|View subscriptions.|P1|
|ADMIN-004|View failed jobs.|P1|
|ADMIN-005|Retry failed jobs.|P1|
|ADMIN-006|View usage by organization.|P1|
|ADMIN-007|View recent AI failures.|P1|
|ADMIN-008|View webhook failures.|P1|
|ADMIN-009|View quota hits.|P1|

### Acceptance criteria

- Admin access is restricted.
    
- Admin actions are audit logged.
    
- Dangerous actions require confirmation.
    

---

## 8.16 Electron desktop companion

### Priority

P1 after web MVP.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|DESK-001|User can sign in from desktop app.|P1|
|DESK-002|User can select organization.|P1|
|DESK-003|User can upload local files.|P1|
|DESK-004|App shows document processing status.|P1|
|DESK-005|Renderer has no Node integration.|P1|
|DESK-006|Context isolation is enabled.|P1|
|DESK-007|IPC surface is minimal and validated.|P1|
|DESK-008|Desktop paid features require server entitlement.|P1|
|DESK-009|App reports crashes.|P1|
|DESK-010|App has update pipeline.|P2|
|DESK-011|App supports offline grace period.|P2|

### Security requirements

- No arbitrary filesystem access from renderer.
    
- No raw Node APIs exposed to renderer.
    
- Validate all IPC payloads.
    
- Restrict navigation.
    
- Use Content Security Policy.
    
- Store tokens securely.
    
- Server verifies subscription status.
    

### Learning deliverable

Create:

```txt
/docs/adr/0007-electron-security-model.md
/docs/runbooks/desktop-update-failure.md
```

---

## 8.17 Real-time status and collaboration

### Priority

P1/P2.

### Requirements

|ID|Requirement|Priority|
|---|---|---|
|RT-001|Document status updates without refresh.|P1|
|RT-002|Client reconnects gracefully.|P1|
|RT-003|User sees latest durable state after refresh.|P1|
|RT-004|Presence shows who is viewing a document/session.|P2|
|RT-005|Team members can watch shared AI session.|P2|
|RT-006|Team members can comment on document.|P2|
|RT-007|Load test simulates concurrent clients.|P2|

### Transport decision

Default:

```txt
SSE for one-way status updates and AI streams.
WebSocket for presence/collaboration.
WebRTC only for future audio/video or peer-to-peer features.
```

---

# 9. Non-functional requirements

## 9.1 Security

|Requirement|Target|
|---|---|
|Server-side auth checks|Required for all protected actions|
|Organization isolation|Required for all org-scoped data|
|Secrets|Never exposed to client|
|Stripe webhooks|Signature verified|
|File uploads|Type and size validated|
|AI endpoint|Rate limited and quota protected|
|Electron IPC|Minimal, typed, validated|
|Audit logs|Required for sensitive org/billing/admin actions|

---

## 9.2 Privacy

- Documents are private to the organization.
    
- Retrieval must filter by organization.
    
- Logs should avoid storing raw sensitive document content unless explicitly needed.
    
- Analytics events should not include document text.
    
- AI prompts/responses should be handled according to provider settings and app privacy policy.
    
- User deletion should define what happens to documents, usage, audit logs, and billing records.
    

---

## 9.3 Reliability

|Area|Requirement|
|---|---|
|Uploads|Failed upload does not create broken ready document|
|Jobs|Retry transient failures|
|Webhooks|Idempotent processing|
|AI|Graceful fallback on provider failure|
|Billing|Subscription state recoverable from Stripe|
|Reconnect|Real-time UI can recover latest state|
|Admin|Failed jobs and webhooks visible|

---

## 9.4 Performance targets

Initial MVP targets:

|Operation|Target|
|---|--:|
|Dashboard initial load|< 2.5s perceived load|
|Document list load|< 1s after auth/session ready|
|Upload request response|< 3s excluding file transfer|
|AI stream first token|< 5s for common requests|
|Document status update|< 2s after status change|
|Billing page load|< 2s|
|API p95 latency excluding AI/model calls|< 800ms|

---

## 9.5 Scalability assumptions

Initial design should support:

```txt
0–1,000 users: MVP validation
1,000–10,000 users: indexes, quotas, observability
10,000–100,000 users: queue hardening, caching, load testing
100,000+ users: isolate hot paths, cost attribution, stricter SLOs
```

Do not build for one million concurrent users in the MVP. Build with clean boundaries so scaling work is possible later.

---

## 9.6 Cost control

Required:

- Quota checks before AI calls.
    
- Token usage storage.
    
- Embedding usage storage.
    
- Per-plan limits.
    
- Admin cost dashboard.
    
- Rate limit for expensive endpoints.
    
- Alerts for abnormal usage spikes.
    

---

## 9.7 Accessibility

MVP should meet basic accessibility expectations:

- Keyboard-accessible navigation.
    
- Clear focus states.
    
- Semantic form labels.
    
- Error messages associated with inputs.
    
- Color contrast sufficient for dashboard UI.
    
- Loading states announced visually.
    

---

# 10. Recommended technical architecture

## 10.1 Default stack

|Layer|Recommended choice|
|---|---|
|Web app|Next.js, React, TypeScript|
|Styling|Tailwind|
|Database|Postgres via Supabase or Neon|
|Auth|Clerk or Supabase Auth|
|Payments|Stripe Billing|
|Email|Resend|
|Analytics|PostHog|
|Errors/tracing|Sentry|
|Rate limiting/cache|Upstash Redis|
|Object storage|Cloudflare R2 or Supabase Storage|
|AI integration|Vercel AI SDK or direct provider SDK|
|Vector search|pgvector first, Pinecone later if needed|
|Desktop|Electron, React, TypeScript|
|Jobs|Trigger.dev, Inngest, Cloudflare Queues, or custom worker|

---

## 10.2 High-level architecture

```txt
Client Web App
  ↓
Next.js Server Actions / API Routes
  ↓
Auth + Authorization Layer
  ↓
Domain Services
  ├── Organization Service
  ├── Billing Service
  ├── Entitlement Service
  ├── Document Service
  ├── AI Service
  ├── Usage Service
  └── Job Service
  ↓
Infrastructure
  ├── Postgres
  ├── Redis
  ├── Object Storage
  ├── Stripe
  ├── AI Provider
  ├── Email Provider
  ├── Sentry
  └── PostHog
```

---

## 10.3 Suggested module boundaries

```txt
/apps/web
/apps/desktop
/packages/db
/packages/auth
/packages/billing
/packages/entitlements
/packages/ai
/packages/jobs
/packages/email
/packages/analytics
/packages/ui
/packages/config
/docs/adr
/docs/runbooks
```

---

# 11. Data model

## 11.1 Core tables

```txt
users
organizations
organization_memberships
invitations
plans
subscriptions
stripe_events
documents
document_chunks
ai_sessions
ai_messages
usage_events
jobs
audit_logs
feature_flags_cache_optional
```

---

## 11.2 Table responsibilities

|Table|Purpose|
|---|---|
|users|Local app user profile mapped to auth provider|
|organizations|Team/workspace boundary|
|organization_memberships|User-role relationship inside org|
|invitations|Pending org invites|
|plans|Internal plan definitions|
|subscriptions|Stripe-backed billing state|
|stripe_events|Webhook idempotency|
|documents|Uploaded document metadata and status|
|document_chunks|Searchable text chunks and embeddings|
|ai_sessions|Conversation/session container|
|ai_messages|User and assistant messages|
|usage_events|Quota, cost, and analytics source-of-truth|
|jobs|Async job status and retries|
|audit_logs|Sensitive action history|

---

## 11.3 Required ownership rules

Every row in these tables must include `organization_id`:

```txt
documents
document_chunks
ai_sessions
ai_messages
usage_events
jobs
audit_logs
subscriptions
invitations
```

Some tables may also include `user_id` for actor tracking:

```txt
documents.created_by_user_id
ai_messages.created_by_user_id
usage_events.user_id
audit_logs.actor_user_id
jobs.created_by_user_id
```

---

## 11.4 Suggested indexes

```txt
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
stripe_events(stripe_event_id unique)
subscriptions(organization_id unique)
```

---

# 12. API and server actions

## 12.1 Auth/org APIs

```txt
POST /api/organizations
GET  /api/organizations/current
POST /api/organizations/switch
GET  /api/organizations/:id/members
POST /api/organizations/:id/invitations
POST /api/invitations/:token/accept
```

## 12.2 Billing APIs

```txt
POST /api/billing/checkout
POST /api/billing/portal
POST /api/webhooks/stripe
GET  /api/billing/subscription
GET  /api/billing/entitlements
```

## 12.3 Document APIs

```txt
POST   /api/documents/upload
GET    /api/documents
GET    /api/documents/:id
DELETE /api/documents/:id
POST   /api/documents/:id/retry-processing
GET    /api/documents/:id/status
```

## 12.4 AI APIs

```txt
POST /api/ai/chat
GET  /api/ai/sessions
GET  /api/ai/sessions/:id
POST /api/ai/messages/:id/feedback
```

## 12.5 Admin APIs

```txt
GET  /api/admin/jobs
POST /api/admin/jobs/:id/retry
GET  /api/admin/usage
GET  /api/admin/webhooks
GET  /api/admin/errors
```

---

# 13. Event tracking plan

## 13.1 Product events

|Event|Properties|
|---|---|
|user_signed_up|auth_provider, referrer|
|organization_created|organization_id|
|invite_sent|organization_id, role|
|invite_accepted|organization_id|
|checkout_started|plan_id, organization_id|
|subscription_started|plan_id, organization_id|
|subscription_canceled|plan_id, organization_id|
|document_uploaded|file_type, file_size, organization_id|
|document_processing_started|document_id|
|document_processing_completed|document_id, duration_ms|
|document_processing_failed|document_id, error_type|
|ai_chat_started|organization_id, session_id|
|ai_chat_completed|tokens_input, tokens_output, duration_ms|
|ai_chat_failed|error_type, provider|
|quota_exceeded|feature, plan_id|
|rate_limit_hit|endpoint, limit_type|
|desktop_app_connected|app_version, platform|

---

## 13.2 Activation metrics

Primary activation metric:

```txt
User uploads a document and receives first AI answer.
```

Secondary activation metrics:

```txt
Organization created
First document uploaded
First document processed
First AI question asked
First cited answer received
Second session within 7 days
```

---

## 13.3 Business metrics

|Metric|Definition|
|---|---|
|Visitor-to-signup conversion|Signups / landing page visitors|
|Signup-to-activation conversion|Activated users / signups|
|Free-to-paid conversion|Paid orgs / active free orgs|
|AI success rate|Completed AI requests / started AI requests|
|Document processing success rate|Ready documents / uploaded documents|
|Cost per active org|AI + storage + infra cost by org|
|Gross margin per plan|Revenue minus variable AI/storage costs|
|Retention|Users/orgs active after 7, 30, 60 days|

---

# 14. Feature flags

## 14.1 Required flags

```txt
rag_v1_enabled
desktop_upload_enabled
realtime_status_enabled
pro_plan_required_for_desktop
new_onboarding_flow
admin_retry_jobs_enabled
```

## 14.2 Feature flag requirements

- P1 and risky features should ship behind flags.
    
- Flags should support user/org targeting.
    
- Beta users can be allowlisted.
    
- Feature usage should be tracked by flag state.
    

---

# 15. Testing strategy

## 15.1 Unit tests

Required for:

- Entitlement calculation.
    
- Quota calculation.
    
- Role/permission checks.
    
- Stripe webhook parsing.
    
- Usage event creation.
    
- Document status transitions.
    
- Job retry state machine.
    

---

## 15.2 Integration tests

Required for:

- Signup → org creation.
    
- Upload → job created.
    
- Job retry → final ready/failed state.
    
- Stripe webhook → subscription updated.
    
- AI chat → usage recorded.
    
- Unauthorized user blocked from another org’s document.
    

---

## 15.3 End-to-end tests

Required MVP flows:

```txt
New user signs up and creates org
User uploads document
Document becomes ready
User asks AI question
User receives answer
User hits quota
User upgrades
User can continue after subscription active
```

---

## 15.4 Failure-mode tests

Required:

- Duplicate Stripe webhook.
    
- AI provider timeout.
    
- Job runs twice.
    
- Upload interrupted.
    
- User changes org ID in URL.
    
- User exceeds quota.
    
- Redis/rate-limit service unavailable.
    
- Document deleted during processing.
    

---

# 16. Milestones and roadmap

## Milestone 0: Project setup

### Deliverables

- Repo created.
    
- Next.js app deployed.
    
- TypeScript, lint, formatting.
    
- CI runs typecheck/lint.
    
- Basic docs folder.
    
- Stack choice ADR.
    

### Acceptance criteria

```txt
App deploys from main branch.
CI blocks broken typecheck/lint.
README explains local setup.
.env.example exists.
```

---

## Milestone 1: SaaS foundation

### Deliverables

- Auth.
    
- Organizations.
    
- Membership roles.
    
- Protected dashboard.
    
- Postgres schema.
    
- Basic audit logs.
    

### Acceptance criteria

```txt
User can sign up.
User can create organization.
User cannot access another org.
Server-side APIs check membership.
```

---

## Milestone 2: Billing and entitlements

### Deliverables

- Free plan.
    
- Pro plan.
    
- Stripe Checkout.
    
- Stripe webhook.
    
- Billing portal.
    
- Subscription table.
    
- Entitlement service.
    

### Acceptance criteria

```txt
Checkout creates subscription.
Webhook updates app state.
Duplicate webhook is safe.
Paid features use server-side entitlement.
```

---

## Milestone 3: Observability and analytics

### Deliverables

- Sentry installed.
    
- PostHog installed.
    
- Core events tracked.
    
- Feature flag created.
    
- Error boundary added.
    

### Acceptance criteria

```txt
Frontend and backend errors appear in Sentry.
Signup and activation events appear in PostHog.
One feature is controlled by feature flag.
```

---

## Milestone 4: AI chat MVP

### Deliverables

- AI chat endpoint.
    
- Streaming response.
    
- Usage events.
    
- Quota check.
    
- Rate limit.
    
- Friendly error handling.
    

### Acceptance criteria

```txt
User can ask question.
Response streams.
Usage is recorded.
Quota blocks excessive usage before AI call.
```

---

## Milestone 5: Document processing and RAG

### Deliverables

- Document upload.
    
- Object storage.
    
- Background processing job.
    
- Text extraction.
    
- Chunking.
    
- Embeddings.
    
- Retrieval.
    
- Cited answers.
    

### Acceptance criteria

```txt
Uploaded document becomes ready asynchronously.
User can ask question over document.
Answer includes source references.
Failed processing is visible.
```

---

## Milestone 6: Admin operations

### Deliverables

- Failed job view.
    
- Retry job action.
    
- Usage dashboard.
    
- Webhook failure visibility.
    
- Basic runbooks.
    

### Acceptance criteria

```txt
Admin can inspect failed jobs.
Admin can retry failed jobs.
Admin can see top usage by org.
Runbooks exist for major incidents.
```

---

## Milestone 7: Electron companion

### Deliverables

- Electron app shell.
    
- Secure IPC.
    
- Sign-in.
    
- Organization selection.
    
- Local file upload.
    
- Crash reporting.
    
- Server entitlement check.
    

### Acceptance criteria

```txt
Renderer cannot access raw Node APIs.
Desktop upload respects org permissions.
Paid desktop feature requires server-side entitlement.
Crashes are reported.
```

---

## Milestone 8: Real-time status and collaboration

### Deliverables

- Live document status.
    
- Reconnect handling.
    
- Optional presence.
    
- Shared AI session view.
    

### Acceptance criteria

```txt
Document status updates without refresh.
Refreshing restores latest state.
Two users can observe shared session or presence.
```

---

## Milestone 9: Performance, caching, and launch

### Deliverables

- Query plan notes.
    
- Indexes.
    
- Entitlement cache.
    
- Load test report.
    
- Landing page.
    
- Onboarding funnel.
    
- Public or private launch.
    

### Acceptance criteria

```txt
Slow queries are measured and improved.
Launch funnel is visible in analytics.
Usage and cost are monitored.
Support path exists.
```

---

# 17. Detailed 12-month delivery plan

|Month|Product focus|Learning focus|Major deliverable|
|---|---|---|---|
|1|App shell, auth, orgs|SaaS foundation|Deployed multi-tenant dashboard|
|2|Billing, observability|Stripe, Sentry, PostHog|Paid Pro plan with webhook entitlements|
|3|AI chat, quotas|Streaming, rate limiting|Quota-protected AI endpoint|
|4|Documents, async, RAG|Jobs, embeddings, retrieval|Document Q&A with citations|
|5|Electron shell|Secure desktop architecture|Safe desktop companion|
|6|Desktop entitlement/update|License checks, crash reporting|Production-hardened Electron app|
|7|Real-time status|SSE/WebSocket basics|Live document processing updates|
|8|Collaboration|Presence, room state|Shared AI session or comments|
|9|Performance|Indexes, query plans|Performance report|
|10|Reliability/cost|Runbooks, cost dashboard|Ops dashboard and incident docs|
|11|Architecture study|Open-source subsystem tracing|Two architecture write-ups|
|12|Launch loop|Metrics, retention, revenue|Public/private launch with analytics|

---

# 18. Risks and mitigations

|Risk|Impact|Mitigation|
|---|---|---|
|AI cost spikes|High cost, poor margins|Quotas, rate limits, token tracking, admin dashboard|
|Bad data model|Security/scaling problems|ADR, schema review, org-scoped ownership rules|
|Weak authorization|Cross-org data leak|Centralized authz helpers, tests, RLS if using Supabase|
|Stripe state mismatch|Users incorrectly locked/unlocked|Webhook idempotency, sync script, runbook|
|Async job duplication|Duplicate records/costs|Idempotency keys, status checks, unique constraints|
|Poor RAG quality|Low user trust|Citations, feedback, eval set, retrieval logging|
|Electron security gap|Local tampering/security issues|Context isolation, safe IPC, server entitlement|
|No observability|Hard to debug production|Sentry/PostHog from early MVP|
|Overbuilding infra|Slow progress|Managed services first, modular monolith|
|Under-testing billing/jobs|Production incidents|Integration/failure-mode tests|

---

# 19. Tech Decisions

These should be decided before or during MVP implementation.

1. Which auth provider will be used: Supabase Auth.
    
2. Which Postgres provider will be used: Supabase.
    
3. Which object storage provider will be used: Supabase Storage.
    
4. Which job system will be used: Cloudflare Queues
    
5. Should MVP use `pgvector` first or a managed vector database? `pgvector` first.
    
6. What exact Free and Pro plan limits should be launched? Decide later
    
7. Should the app target individuals first or teams first? Teams first.
    
8. Should uploaded document content be retained permanently by default? Yes.
    
9. What AI provider/model should be default for MVP? OpenAI.
    
10. What is the minimum useful citation quality for launch? 
    

---

# 20. Launch readiness checklist

## Product

```txt
Landing page exists.
Signup works.
Onboarding works.
User can create organization.
User can upload document.
Document processing works.
User can ask AI question.
Answer includes useful source references.
Usage limits are visible.
Upgrade flow works.
Billing portal works.
Support/contact path exists.
```

## Engineering

```txt
CI passes.
Migrations are versioned.
.env.example is complete.
Sentry is receiving errors.
PostHog is receiving events.
Stripe webhook is idempotent.
AI endpoint is rate limited.
Quota checks happen before AI calls.
Failed jobs are visible.
Runbooks exist.
Backups are configured.
```

## Security

```txt
Server-side auth checks exist.
Org isolation is tested.
Stripe signatures are verified.
Secrets are not exposed.
File uploads are validated.
Admin routes are protected.
Electron renderer has no raw Node access.
```

## Business

```txt
Free plan defined.
Pro plan defined.
Pricing page exists.
Upgrade prompt exists.
Activation funnel visible.
Cost per user/org visible.
Manual support process exists.
```

---

# 21. Definition of done

The project is considered successful when:

1. A new user can sign up, create an organization, upload a document, and receive an AI answer with citations.
    
2. The app can accept payment and unlock Pro features through server-side Stripe webhook state.
    
3. AI usage is rate-limited, quota-protected, and tracked.
    
4. Document processing runs asynchronously with retry and failure visibility.
    
5. Sentry and PostHog provide production visibility.
    
6. The builder has written ADRs for stack, auth, billing, jobs, AI, observability, and Electron security.
    
7. The app can be launched to real users without relying on manual database edits or hidden local-only state.
    
8. The architecture can be reused as a starter for future indie AI products.
    

---

# 22. Required documentation artifacts

Create these documents as part of the project:

```txt
/docs/adr/0001-stack-choice.md
/docs/adr/0002-authentication-model.md
/docs/adr/0003-multi-tenant-data-model.md
/docs/adr/0004-billing-and-entitlements.md
/docs/adr/0005-background-job-architecture.md
/docs/adr/0006-ai-usage-and-cost-control.md
/docs/adr/0007-observability-and-analytics.md
/docs/adr/0008-electron-security-model.md
/docs/adr/0009-realtime-status-architecture.md
/docs/runbooks/stripe-webhooks-failing.md
/docs/runbooks/ai-provider-outage.md
/docs/runbooks/queue-backlog.md
/docs/runbooks/database-slow.md
/docs/runbooks/desktop-update-failure.md
/docs/performance/query-plans.md
/docs/performance/load-test-report.md
/docs/studies/open-source-architecture-study-1.md
/docs/studies/open-source-architecture-study-2.md
```

---

# 23. First implementation sprint

## Sprint 1 goal

Build the foundation for a production-shaped SaaS app.

## Sprint 1 duration

1–2 weeks.

## Sprint 1 scope

### Build

```txt
Next.js app
TypeScript
Tailwind
Auth provider
Protected dashboard
Organization creation
Postgres schema
CI
Deployment
.env.example
README
```

### Write

```txt
/docs/adr/0001-stack-choice.md
/docs/adr/0002-authentication-model.md
/docs/adr/0003-multi-tenant-data-model.md
```

### Acceptance criteria

```txt
A user can sign up.
A user can create an organization.
A user can access protected dashboard.
A user cannot access dashboard without signing in.
Database has users, organizations, and memberships.
CI runs lint and typecheck.
App deploys successfully.
```

---

# 24. PRD summary

This product should be built as a **modular monolith AI SaaS** first, not as a complex distributed system. The main product value is document-based AI assistance for individuals and small teams. The main learning value is that every product feature maps to a serious production skill: auth, billing, entitlements, async jobs, RAG, quotas, observability, Electron hardening, real-time systems, and performance engineering.

The MVP should prove the core loop:

```txt
Signup
→ create organization
→ upload document
→ process asynchronously
→ ask AI question
→ receive cited answer
→ hit usage limit
→ upgrade
→ continue using product
```

That loop is the heart of both the product and the learning path.
