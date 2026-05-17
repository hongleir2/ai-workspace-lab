# 0009 — Observability and Product Analytics

## Status
Accepted

## Context
As the product grows, we need to understand production errors (Sentry), track user behaviour and
feature adoption (PostHog events), and control feature rollouts across cohorts (PostHog feature
flags). These are two separate concerns — error observability and product analytics — sharing a
common principle: user and organisation context must attach to every signal so incidents and funnels
can be scoped correctly.

## Decision

### Error observability — Sentry
- `@sentry/nextjs` initialised for browser, server, and edge runtimes via SDK init files in `apps/web/src/`.
- Every `/app/[orgSlug]/*` request attaches `user.id`, `organization.id`, `organization.slug`, and
  `membership.role` in `OrgLayout` via `Sentry.setUser` / `Sentry.setContext`.
- PII rule: **only IDs and non-personal metadata** go into Sentry context. Email and display name are
  never attached.
- Source maps uploaded at build time via `withSentryConfig`. `SENTRY_AUTH_TOKEN` is server-only and
  never reaches the client bundle.

### Product analytics — PostHog
- Browser SDK (`posthog-js`) initialised in `PostHogProvider`, wrapped around the root layout.
- Pageviews tracked manually (`capture_pageview: false`) via `PageViewTracker` inside `<Suspense>` —
  required by Next.js App Router.
- **All analytics calls go through `packages/analytics`**. No raw `posthog.capture()` calls are
  scattered in feature code.

#### Events tracked

| Event | Trigger | Properties |
|---|---|---|
| `user_signed_up` | sign-up server action | `email` |
| `user_signed_in` | sign-in server action | `email` |
| `organization_created` | create-org server action | `org_id`, `org_slug` |
| `dashboard_viewed` | client `PageAnalytics` | `org_slug` |
| `billing_viewed` | client `PageAnalytics` | `org_slug` |
| `checkout_started` | billing page client | `org_slug`, `price_id` |
| `checkout_success_viewed` | billing success client | `org_slug` |
| `checkout_canceled` | billing canceled client | `org_slug` |
| `billing_portal_opened` | billing page client | `org_slug` |

#### User and org context policy
- `AnalyticsIdentity` calls `identifyUser(userId)` + `identifyOrganization(orgId, orgSlug)` on every
  `/app/[orgSlug]` entry, associating browser events with the PostHog person and org group.
- PII rule: only `user.id` (UUID) and `organization.id`/`slug` are sent to PostHog. Email is included
  only in sign-up/sign-in server events where it is the natural activation key.

### Feature flags — PostHog
- **Client-side:** `isFeatureEnabled(flag)` from `packages/analytics`. Reads from `posthog-js`,
  falls back to `FLAG_DEFAULTS` when PostHog is not initialised or when running server-side.
- **Server-side:** `getServerFeatureFlag(flag, distinctId)` in `apps/web/src/lib/analytics/flags.ts`.
  Uses `posthog-node` (one client per call — serverless pattern), falls back to `FLAG_DEFAULTS` on
  error or when no key is configured.
- **Safe defaults:** all flags default to `false`. Enabling a feature is always opt-in.
- Flags are defined once in `packages/analytics/src/flags.ts` as a TypeScript union + defaults map.
  Adding a flag requires a code change here and a matching flag in the PostHog dashboard.

#### Flags

| Flag | Default | Feature |
|---|---|---|
| `document_upload_enabled` | `false` | Document upload flow |
| `ai_chat_enabled` | `false` | AI question-answer |
| `rag_v1_enabled` | `false` | RAG pipeline v1 |
| `desktop_upload_enabled` | `false` | Desktop companion upload |
| `realtime_status_enabled` | `false` | Real-time processing status |

### Privacy rules
1. No email, display name, or IP address in Sentry context.
2. Email included in PostHog only for `user_signed_up` / `user_signed_in` to support activation
   funnel analysis.
3. All `distinctId` values are UUIDs from the `users` table, not Supabase auth-provider IDs.
4. Review PostHog data residency settings before production launch in EU markets.

### Alert ideas
- Sentry: alert on error spike (>10 errors/min) on `/api/webhooks/stripe`.
- Sentry: alert on any `FATAL` level event in production.
- PostHog: webhook alert when `checkout_started` drops to 0 for >1 hour during business hours.
- PostHog: alert when `user_signed_up` rate drops >50% week-over-week.

## Consequences
- `NEXT_PUBLIC_POSTHOG_KEY` is required in production for analytics to work. Server-side flag
  evaluation additionally requires `POSTHOG_PERSONAL_API_KEY` (scope: Local feature flag evaluation
  → Read).
- `posthog-node` creates a new client per server-action call. This is intentional for serverless
  and has negligible overhead at current volume.
- Feature flags with no PostHog configuration silently use defaults — no runtime errors in local dev
  without env vars.
- PostHog OTLP/OpenTelemetry Logs (separate LLM observability product) is intentionally excluded;
  it conflicts with the existing Sentry OTel setup and is not needed for event analytics.
