# Frontend page map

Source of truth for every frontend route in `ai-workspace-lab`. Before creating, renaming, or deleting any frontend route, read this file and keep it updated.

> **Status:** Phase 0 — defines the target. Most pages are not yet implemented. The MVP cut is in [§19](#19-minimal-mvp-page-cut).

---

## Frontend route strategy

Use this as the app's route convention:

```txt
Public routes:
/

Auth routes:
/sign-in
/sign-up

App routes:
/app
/app/[orgSlug]
/app/[orgSlug]/...

Admin routes:
/admin/...

Account routes:
/account/...
```

Recommended behavior:

```txt
/app
→ redirects to the user's most recent organization
→ or redirects to onboarding if the user has no organization

/app/[orgSlug]
→ resolves organization by slug
→ checks active membership
→ rejects access if user is not a member
```

This is better than hiding the active org only in a cookie because it makes deep links, testing, support, and authorization clearer.

---

## 1. Public marketing pages

| Route        | Page                 | Priority | Sprint | Purpose                    |
| ------------ | -------------------- | -------: | -----: | -------------------------- |
| `/`          | Landing page         |       P0 |    0–1 | Explain product, show CTA  |
| `/pricing`   | Pricing page         |       P0 |      4 | Show Free vs Pro plan      |
| `/contact`   | Contact/support page |       P1 |     24 | Let users contact you      |
| `/privacy`   | Privacy policy       |       P1 |     24 | Launch/legal readiness     |
| `/terms`     | Terms of service     |       P1 |     24 | Launch/legal readiness     |
| `/waitlist`  | Waitlist page        |       P2 |     24 | Optional prelaunch capture |
| `/changelog` | Changelog            |       P2 |     24 | Product updates            |

### `/`

**Purpose**

Convert visitors into signups.

**Main components**

```txt
Hero
Product value section
Document Q&A demo
AI citation demo
Pricing CTA
Signup CTA
Footer
```

**Primary CTA**

```txt
Get started
```

**Analytics**

```txt
landing_viewed
signup_cta_clicked
pricing_cta_clicked
```

---

## 2. Auth pages

| Route                    | Page          | Priority | Sprint | Purpose                      |
| ------------------------ | ------------- | -------: | -----: | ---------------------------- |
| `/sign-in`               | Sign in       |       P0 |      1 | User login                   |
| `/sign-up`               | Sign up       |       P0 |      1 | New account creation         |
| `/accept-invite/[token]` | Accept invite |       P1 |     12 | Join organization from email |
| `/auth/callback`         | Auth callback |    P0/P1 |      1 | Provider callback if needed  |
| `/auth/error`            | Auth error    |       P1 |      1 | Friendly auth failure        |

### Authorization rules

```txt
Signed-out users can access auth pages.
Signed-in users should redirect away from sign-in/sign-up.
Invite acceptance must validate token server-side.
```

### Analytics

```txt
sign_in_viewed
sign_up_viewed
user_signed_up
user_signed_in
invite_accept_started
invite_accepted
invite_accept_failed
```

---

## 3. Onboarding pages

| Route                             | Page                  | Priority | Sprint | Purpose                           |
| --------------------------------- | --------------------- | -------: | -----: | --------------------------------- |
| `/onboarding`                     | Onboarding router     |       P0 |      2 | Direct user to next required step |
| `/onboarding/create-organization` | Create organization   |       P0 |      2 | First workspace creation          |
| `/onboarding/upload-document`     | Upload first document |       P0 |    6–7 | Activation step                   |
| `/onboarding/ask-ai`              | Ask first AI question |       P0 |    8–9 | Activation step                   |
| `/onboarding/invite-team`         | Invite teammate       |       P1 |     12 | Team activation                   |
| `/onboarding/upgrade`             | Upgrade prompt        |       P1 |    4–8 | Monetization path                 |

### Onboarding state machine

```txt
No organization
→ create organization

Organization exists, no document
→ upload document

Document exists, no ready document
→ show processing state

Ready document exists, no AI session
→ ask first AI question

First AI answer received
→ onboarding complete
```

### Analytics

```txt
onboarding_started
organization_created
first_document_upload_started
first_document_uploaded
first_document_ready
first_ai_question_started
first_ai_answer_received
onboarding_completed
```

---

## 4. Main app shell

### Route group

```txt
/app
/app/[orgSlug]
```

| Route                          | Page                   | Priority | Sprint | Purpose                               |
| ------------------------------ | ---------------------- | -------: | -----: | ------------------------------------- |
| `/app`                         | App router             |       P0 |      2 | Redirect to current org or onboarding |
| `/app/[orgSlug]`               | Organization dashboard |       P0 |      2 | Workspace home                        |
| `/app/[orgSlug]/search`        | Global search          |       P2 |    10+ | Search documents/sessions             |
| `/app/[orgSlug]/notifications` | Notifications          |       P1 |     12 | In-app notifications                  |

### App shell components

```txt
Sidebar
Top navigation
Organization switcher
User menu
Plan badge
Usage indicator
Global command/search placeholder
Mobile nav
```

### Required server checks

Every `/app/[orgSlug]/*` route must do:

```txt
requireUser()
resolveOrganizationBySlug(orgSlug)
requireMembership(userId, organizationId)
```

### App shell analytics

```txt
app_opened
organization_switched
dashboard_viewed
```

---

## 5. Organization dashboard pages

| Route                       | Page               | Priority | Sprint | Purpose                      |
| --------------------------- | ------------------ | -------: | -----: | ---------------------------- |
| `/app/[orgSlug]`            | Dashboard overview |       P0 |      2 | Org summary and next actions |
| `/app/[orgSlug]/activity`   | Activity feed      |       P2 |    14+ | Recent org activity          |
| `/app/[orgSlug]/audit-logs` | Audit logs         |       P1 |  11–14 | Sensitive action history     |

### Dashboard widgets

```txt
Onboarding checklist
Recent documents
Recent AI sessions
Usage summary
Plan status
Failed processing alerts
Upgrade CTA
```

### Backend dependencies

```txt
organizations
organization_memberships
documents
ai_sessions
usage_counters
subscriptions
audit_logs
```

---

## 6. Document pages

| Route                                            | Page               | Priority | Sprint | Purpose                   |
| ------------------------------------------------ | ------------------ | -------: | -----: | ------------------------- |
| `/app/[orgSlug]/documents`                       | Document list      |       P0 |      6 | View uploaded documents   |
| `/app/[orgSlug]/documents/new`                   | Upload document    |       P0 |      6 | Upload file               |
| `/app/[orgSlug]/documents/[documentId]`          | Document detail    |       P0 |      7 | Status, metadata, actions |
| `/app/[orgSlug]/documents/[documentId]/ask`      | Ask about document |       P0 |      9 | Document-scoped Q&A       |
| `/app/[orgSlug]/documents/[documentId]/chunks`   | Chunks/debug view  |       P1 |   9–11 | Inspect RAG chunks        |
| `/app/[orgSlug]/documents/[documentId]/comments` | Document comments  |       P2 |     21 | Collaboration             |
| `/app/[orgSlug]/documents/[documentId]/settings` | Document settings  |       P1 |  10–14 | Rename/delete/reprocess   |

### `/app/[orgSlug]/documents`

**Main states**

```txt
Empty state: no documents
Loading state
Upload disabled due to quota
Processing documents
Ready documents
Failed documents
Deleted/archived excluded by default
```

**Actions**

```txt
Upload document
Open document
Retry failed processing
Delete document
Add to collection
Ask AI
```

**Analytics**

```txt
documents_viewed
document_upload_clicked
document_opened
document_retry_clicked
document_deleted
```

### `/app/[orgSlug]/documents/new`

**Requirements**

```txt
Check membership.
Check document upload entitlement.
Check file size limit.
Check file type.
Record document_uploaded usage event.
Create storage_objects row.
Create documents row.
Create process_document job.
```

**Analytics**

```txt
document_upload_started
document_uploaded
document_upload_failed
quota_exceeded
```

### `/app/[orgSlug]/documents/[documentId]`

**Tabs**

```txt
Overview
Processing status
Ask AI
Sources/chunks
Settings
Comments later
```

**Authorization**

```txt
document.organization_id must match current organization.
```

---

## 7. Collection pages

| Route                                                | Page                | Priority | Sprint | Purpose                  |
| ---------------------------------------------------- | ------------------- | -------: | -----: | ------------------------ |
| `/app/[orgSlug]/collections`                         | Collections list    |       P1 |     10 | Group documents          |
| `/app/[orgSlug]/collections/new`                     | New collection      |       P1 |     10 | Create collection        |
| `/app/[orgSlug]/collections/[collectionId]`          | Collection detail   |       P1 |     10 | View docs in collection  |
| `/app/[orgSlug]/collections/[collectionId]/ask`      | Ask collection      |       P1 |     10 | Collection-scoped Q&A    |
| `/app/[orgSlug]/collections/[collectionId]/settings` | Collection settings |       P2 |    10+ | Rename/delete collection |

### Backend dependencies

```txt
document_collections
document_collection_items
documents
document_chunks
ai_sessions
```

### Authorization

```txt
Collection must belong to current organization.
All documents added to collection must belong to same organization.
```

---

## 8. AI chat pages

| Route                                             | Page                |     Priority | Sprint | Purpose                       |
| ------------------------------------------------- | ------------------- | -----------: | -----: | ----------------------------- |
| `/app/[orgSlug]/ai`                               | AI chat home        |           P0 |      8 | Start or continue AI sessions |
| `/app/[orgSlug]/ai/new`                           | New AI session      |           P0 |      8 | Create new chat               |
| `/app/[orgSlug]/ai/sessions`                      | AI session list     |           P1 |   8–10 | Browse previous chats         |
| `/app/[orgSlug]/ai/sessions/[sessionId]`          | AI session detail   |           P0 |    8–9 | Chat UI                       |
| `/app/[orgSlug]/ai/sessions/[sessionId]/sources`  | Source references   |           P1 |      9 | Inspect citations             |
| `/app/[orgSlug]/ai/sessions/[sessionId]/comments` | AI session comments |           P2 |     21 | Collaboration                 |
| `/app/[orgSlug]/ai/feedback`                      | AI feedback review  | P1 admin-ish |     13 | Review answer feedback        |

### AI chat UI components

```txt
Prompt box
Streaming assistant message
Message list
Source citation cards
Scope selector
Quota remaining indicator
Model/status indicator
Feedback buttons
Regenerate button later
```

### Scope selector options

```txt
All organization documents
Specific collection
Specific document
No document context / general chat
```

### Backend dependencies

```txt
ai_sessions
ai_messages
ai_message_sources
ai_feedback
prompt_versions
usage_events
usage_counters
document_chunks
document_collections
```

### Required server checks

Before calling AI provider:

```txt
requireUser()
requireOrganization()
requireMembership()
checkEntitlement("ai_messages")
checkQuota("ai_messages")
checkRateLimit("/api/ai/chat")
resolveRagScope()
verify all retrieved chunks belong to organization
```

### Analytics

```txt
ai_chat_started
ai_chat_completed
ai_chat_failed
ai_source_clicked
ai_feedback_submitted
quota_exceeded
rate_limit_hit
```

---

## 9. Usage pages

| Route                            | Page                  |       Priority | Sprint | Purpose                    |
| -------------------------------- | --------------------- | -------------: | -----: | -------------------------- |
| `/app/[orgSlug]/usage`           | Usage overview        |             P0 |      3 | Show quota and consumption |
| `/app/[orgSlug]/usage/ai`        | AI usage detail       |             P1 |   8–13 | Token and cost detail      |
| `/app/[orgSlug]/usage/documents` | Document usage detail |             P1 |   6–10 | Upload/storage usage       |
| `/app/[orgSlug]/usage/costs`     | Cost breakdown        | P1 admin/owner |     23 | Cost visibility            |

### Usage overview cards

```txt
AI messages used
AI tokens used
Document uploads used
Storage used
Current plan
Billing period
Quota reset date
Upgrade CTA
```

### Backend dependencies

```txt
usage_events
usage_counters
plan_limits
subscriptions
plans
```

### Authorization

```txt
Members can view basic usage.
Owner/admin can view detailed cost breakdown.
```

---

## 10. Billing pages

| Route                             | Page                     | Priority | Sprint | Purpose                       |
| --------------------------------- | ------------------------ | -------: | -----: | ----------------------------- |
| `/app/[orgSlug]/billing`          | Billing overview         |       P0 |      4 | Current plan and subscription |
| `/app/[orgSlug]/billing/checkout` | Checkout redirect helper |       P0 |      4 | Start Stripe Checkout         |
| `/app/[orgSlug]/settings/billing/success`  | Checkout success         |       P0 |      4 | Explain webhook provisioning  |
| `/app/[orgSlug]/settings/billing/canceled` | Checkout canceled        |       P1 |      4 | Return to billing             |
| `/app/[orgSlug]/billing/portal`   | Portal redirect helper   |       P0 |      4 | Open Stripe customer portal   |
| `/app/[orgSlug]/billing/history`  | Billing history          |       P2 |     4+ | Optional invoice display      |

### Billing page components

```txt
Current plan card
Plan limits table
Upgrade/downgrade CTA
Manage billing button
Payment status warning
Past-due warning
Cancel-at-period-end warning
```

### Backend dependencies

```txt
plans
plan_limits
billing_customers
subscriptions
stripe_events
usage_counters
```

### Authorization

```txt
Only owner can manage billing in MVP.
Admin billing access can be added later.
Members can view plan badge but not manage billing.
```

### Analytics

```txt
billing_viewed
checkout_started
checkout_success_viewed
checkout_canceled
billing_portal_opened
subscription_started
subscription_canceled
```

---

## 11. Members and organization settings pages

| Route                              | Page                  | Priority | Sprint | Purpose              |
| ---------------------------------- | --------------------- | -------: | -----: | -------------------- |
| `/app/[orgSlug]/members`           | Members list          |       P1 |     12 | View team            |
| `/app/[orgSlug]/members/invite`    | Invite member         |       P1 |     12 | Send invite          |
| `/app/[orgSlug]/members/[userId]`  | Member detail         |       P2 |    12+ | Role and activity    |
| `/app/[orgSlug]/settings`          | Organization settings |       P0 |      2 | Redirects to /general |
| `/app/[orgSlug]/settings/general`  | General settings      |       P0 |      2 | Name/slug/role (read-only) |
| `/app/[orgSlug]/settings/members`  | Members settings      |       P1 |      2 | Placeholder — manage team (Sprint 12) |
| `/app/[orgSlug]/settings/billing`  | Billing settings      |       P1 |      2 | Placeholder — plan/payment (Sprint 4) |
| `/app/[orgSlug]/settings/security` | Org security          |       P2 |    14+ | Future               |
| `/app/[orgSlug]/settings/danger`   | Danger zone           |       P2 |    14+ | Shell scaffolded Sprint 2; actions Sprint 14+ |

### Authorization

```txt
Owner/admin can invite members.
Owner can remove members.
Owner can manage billing.
Member can view basic team list.
```

### Backend dependencies

```txt
organizations
organization_memberships
invitations
audit_logs
email_events
```

### Analytics

```txt
members_viewed
invite_started
invite_sent
invite_failed
member_role_changed
member_removed
```

---

## 12. Notification pages

| Route                          | Page                     | Priority | Sprint | Purpose             |
| ------------------------------ | ------------------------ | -------: | -----: | ------------------- |
| `/app/[orgSlug]/notifications` | Notifications list       |       P1 |     12 | View notifications  |
| `/account/notifications`       | Notification preferences |       P2 |    12+ | User-level settings |

### Backend dependencies

```txt
notifications
email_events
```

### Notification types

```txt
document_ready
document_failed
invite_received
quota_warning
payment_failed
comment_mention
```

---

## 13. Account pages

| Route                    | Page             | Priority | Sprint | Purpose                        |
| ------------------------ | ---------------- | -------: | -----: | ------------------------------ |
| `/account`               | Account overview |       P1 |    1–2 | User account shell             |
| `/account/profile`       | Profile          |       P1 |    1–2 | Name/avatar/email display      |
| `/account/security`      | Security         |       P2 |     1+ | Link to auth provider controls |
| `/account/organizations` | My organizations |       P1 |      2 | List/switch organizations      |
| `/account/desktop`       | Desktop devices  |       P1 |  15–18 | Manage desktop installations   |
| `/account/api-keys`      | API keys         |       P2 | future | Optional developer feature     |

### Backend dependencies

```txt
users
organization_memberships
organizations
desktop_installations
desktop_sessions
```

---

## 14. Admin/debug pages

Use `/admin` for internal operator pages. These are not organization-scoped product pages; they are platform-admin pages.

| Route                    | Page             | Priority | Sprint | Purpose                    |
| ------------------------ | ---------------- | -------: | -----: | -------------------------- |
| `/admin`                 | Admin overview   |       P1 |     11 | Internal dashboard         |
| `/admin/users`           | User admin       |       P1 |     11 | Inspect users              |
| `/admin/organizations`   | Org admin        |       P1 |     11 | Inspect orgs               |
| `/admin/jobs`            | Jobs admin       |       P1 |     11 | View failed jobs           |
| `/admin/jobs/[jobId]`    | Job detail       |       P1 |     11 | Inspect/retry job          |
| `/admin/webhooks/stripe` | Stripe webhooks  |       P1 |     11 | Inspect webhook processing |
| `/admin/usage`           | Usage admin      |       P1 |     11 | Usage by org/user          |
| `/admin/costs`           | Cost admin       |       P1 |     23 | AI/storage cost            |
| `/admin/ai-failures`     | AI failures      |       P1 |  11–13 | Debug AI errors            |
| `/admin/feedback`        | AI feedback      |       P1 |     13 | Review bad answers         |
| `/admin/feature-flags`   | Feature flags    |       P2 |     5+ | Link/use PostHog           |
| `/admin/incidents`       | Incidents        |       P2 |     23 | Incident tracking          |
| `/admin/support`         | Support requests |       P2 |     24 | Support queue              |
| `/admin/beta-feedback`   | Beta feedback    |       P2 |     24 | Launch feedback            |

### Admin authorization

Create a separate admin check:

```txt
requirePlatformAdmin()
```

Do not treat organization owner as platform admin.

### Admin analytics

Usually skip product analytics for admin pages, but log audit actions:

```txt
admin.job.retry
admin.webhook.inspect
admin.subscription.inspect
admin.user.inspect
```

---

## 15. Developer-only pages

These should only be enabled in development.

| Route                | Page              | Priority | Sprint | Purpose                  |
| -------------------- | ----------------- | -------: | -----: | ------------------------ |
| `/dev`               | Dev tools index   |       P2 |      5 | Local debug              |
| `/dev/sentry-test`   | Sentry test       |       P2 |      5 | Verify error capture     |
| `/dev/feature-flags` | Feature flag test |       P2 |      5 | Verify flags             |
| `/dev/design-system` | UI components     |       P2 |    0–5 | Component preview        |
| `/dev/auth-state`    | Auth debug        |       P2 |      1 | Inspect current user/org |
| `/dev/env`           | Env debug         |       P2 |      0 | Safe env validation      |

### Safety rule

```txt
All /dev routes must 404 or be disabled outside development.
```

---

## 16. Error, loading, and empty states

These are not routes, but Claude Code should treat them as required frontend work.

### Next.js route files

```txt
app/not-found.tsx
app/error.tsx
app/global-error.tsx
app/loading.tsx
app/app/[orgSlug]/loading.tsx
app/app/[orgSlug]/error.tsx
```

### Required states per major page

Every major app page should have:

```txt
Loading state
Empty state
Unauthorized state
Quota exceeded state where relevant
Error state
Retry CTA where relevant
Upgrade CTA where relevant
```

### Page-specific empty states

| Page          | Empty state                    |
| ------------- | ------------------------------ |
| Documents     | "Upload your first document"   |
| Collections   | "Create your first collection" |
| AI sessions   | "Ask your first question"      |
| Usage         | "No usage yet"                 |
| Members       | "Invite your first teammate"   |
| Notifications | "No notifications yet"         |
| Admin jobs    | "No failed jobs"               |

---

## 17. Electron desktop screen map

These are not Next.js routes unless you choose to reuse the web router inside Electron. Treat them as desktop app screens.

| Screen                | Priority | Sprint | Purpose                       |
| --------------------- | -------: | -----: | ----------------------------- |
| Welcome               |       P1 |     15 | First desktop launch          |
| Sign in               |       P1 |     15 | Authenticate user             |
| Auth callback         |       P1 |     15 | Complete login                |
| Organization selector |       P1 |     15 | Choose workspace              |
| Desktop home          |       P1 |     15 | Main desktop dashboard        |
| Upload file           |       P1 |     16 | Select and upload local files |
| Recent uploads        |       P1 |     16 | See desktop upload history    |
| Processing status     |       P1 |     16 | See cloud processing state    |
| Entitlement required  |       P1 |     17 | Pro desktop feature locked    |
| Offline grace warning |       P1 |     17 | Limited offline access        |
| Reconnect required    |       P1 |     17 | Server entitlement needed     |
| Settings              |       P1 |  15–18 | Device/account settings       |
| About/version         |       P1 |     18 | App version/update status     |
| Update available      |       P2 |     18 | Update UX                     |
| Update failed         |       P2 |     18 | Update error state            |
| Crash recovery        |       P2 |     18 | Friendly recovery screen      |

### Desktop screen rules

```txt
Renderer must not access raw Node APIs.
All IPC calls must be typed and validated.
Paid desktop features must call server entitlement endpoint.
Local entitlement cache is only a UX optimization.
```

---

## 18. Recommended frontend folder structure

Use this inside `apps/web`:

```txt
apps/web/app
  page.tsx
  pricing/page.tsx
  contact/page.tsx
  privacy/page.tsx
  terms/page.tsx

  sign-in/[[...sign-in]]/page.tsx
  sign-up/[[...sign-up]]/page.tsx
  accept-invite/[token]/page.tsx

  onboarding/page.tsx
  onboarding/create-organization/page.tsx
  onboarding/upload-document/page.tsx
  onboarding/ask-ai/page.tsx
  onboarding/invite-team/page.tsx

  app/page.tsx
  app/[orgSlug]/layout.tsx
  app/[orgSlug]/page.tsx
  app/[orgSlug]/documents/page.tsx
  app/[orgSlug]/documents/new/page.tsx
  app/[orgSlug]/documents/[documentId]/page.tsx
  app/[orgSlug]/documents/[documentId]/ask/page.tsx
  app/[orgSlug]/collections/page.tsx
  app/[orgSlug]/collections/new/page.tsx
  app/[orgSlug]/collections/[collectionId]/page.tsx
  app/[orgSlug]/collections/[collectionId]/ask/page.tsx
  app/[orgSlug]/ai/page.tsx
  app/[orgSlug]/ai/new/page.tsx
  app/[orgSlug]/ai/sessions/page.tsx
  app/[orgSlug]/ai/sessions/[sessionId]/page.tsx
  app/[orgSlug]/usage/page.tsx
  app/[orgSlug]/billing/page.tsx
  app/[orgSlug]/members/page.tsx
  app/[orgSlug]/settings/page.tsx
  app/[orgSlug]/audit-logs/page.tsx
  app/[orgSlug]/notifications/page.tsx

  account/page.tsx
  account/profile/page.tsx
  account/organizations/page.tsx
  account/desktop/page.tsx
  account/notifications/page.tsx

  admin/page.tsx
  admin/users/page.tsx
  admin/organizations/page.tsx
  admin/jobs/page.tsx
  admin/jobs/[jobId]/page.tsx
  admin/webhooks/stripe/page.tsx
  admin/usage/page.tsx
  admin/costs/page.tsx
  admin/ai-failures/page.tsx
  admin/feedback/page.tsx

  dev/page.tsx
  dev/sentry-test/page.tsx
  dev/design-system/page.tsx

  not-found.tsx
  error.tsx
  global-error.tsx
  loading.tsx
```

---

## 19. Minimal MVP page cut

For the first MVP, do not build every page. Build this page set first:

```txt
/
/pricing
/sign-in
/sign-up
/onboarding
/onboarding/create-organization
/app
/app/[orgSlug]
/app/[orgSlug]/documents
/app/[orgSlug]/documents/new
/app/[orgSlug]/documents/[documentId]
/app/[orgSlug]/documents/[documentId]/ask
/app/[orgSlug]/ai
/app/[orgSlug]/ai/sessions/[sessionId]
/app/[orgSlug]/usage
/app/[orgSlug]/billing
/app/[orgSlug]/settings
/admin
/admin/jobs
/admin/webhooks/stripe
/admin/usage
```

Then add:

```txt
/app/[orgSlug]/collections
/app/[orgSlug]/members
/app/[orgSlug]/notifications
/account/desktop
Electron screens
real-time/collaboration pages
support/beta feedback pages
```

---

## 20. Day 7 — Add route placeholders from frontend page map

Replace the original Day 7 task with this.

**Claude Code task**

```txt
Read docs/product/frontend-page-map.md.

Create route placeholders for the MVP page cut only:

- /
- /pricing
- /sign-in
- /sign-up
- /onboarding
- /onboarding/create-organization
- /app
- /app/[orgSlug]
- /app/[orgSlug]/documents
- /app/[orgSlug]/documents/new
- /app/[orgSlug]/documents/[documentId]
- /app/[orgSlug]/documents/[documentId]/ask
- /app/[orgSlug]/ai
- /app/[orgSlug]/ai/sessions/[sessionId]
- /app/[orgSlug]/usage
- /app/[orgSlug]/billing
- /app/[orgSlug]/settings
- /admin
- /admin/jobs
- /admin/webhooks/stripe
- /admin/usage

Add shared layouts:
- public marketing layout if useful
- app org layout for /app/[orgSlug]
- admin layout

Each placeholder page should show:
- page title
- route
- priority
- target sprint
- required backend dependencies
```

**Done when**

```txt
MVP route placeholders exist.
Navigation links match frontend-page-map.md.
No non-MVP pages are created yet unless needed.
```

---

## 21. Route-level authorization matrix

| Route group               | Required check                                   |
| ------------------------- | ------------------------------------------------ |
| `/` public pages          | None                                             |
| `/pricing`                | None                                             |
| `/sign-in`, `/sign-up`    | Redirect signed-in users                         |
| `/onboarding/*`           | `requireUser()`                                  |
| `/app`                    | `requireUser()`                                  |
| `/app/[orgSlug]/*`        | `requireUser()` + `requireMembership()`          |
| `/app/[orgSlug]/billing`  | View: member; manage: owner                      |
| `/app/[orgSlug]/members`  | View: member; invite: admin/owner                |
| `/app/[orgSlug]/settings` | View: member; edit: owner/admin depending action |
| `/admin/*`                | `requirePlatformAdmin()`                         |
| `/dev/*`                  | Development only                                 |
| `/account/*`              | `requireUser()`                                  |

---

## 22. Page build rule for Claude Code

When adding a frontend page:

```txt
1. Check docs/product/frontend-page-map.md.
2. Confirm the route belongs to the current sprint.
3. Add route-level authorization first.
4. Add loading, empty, and error states.
5. Add analytics events listed in the page map.
6. Add server-side org checks for every org-scoped route.
7. Do not fetch organization-scoped data without filtering by organization_id.
8. Do not create new routes without updating frontend-page-map.md.
```
