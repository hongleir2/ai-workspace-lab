# 0007 — Entitlements and Usage Limits

## Status

Accepted

## Context

The product sells organization-scoped plans with **plan limits** (`plan_limits`) and enforces them with **usage counters** (`usage_counters`) and **usage events** (`usage_events`). Members need a trustworthy place in the app to see **current plan**, **what is allowed**, and **how much has been used** in the active reset window, without relying on client-side checks.

We need a single place that documents how limits are resolved, how billing periods interact with resets, and how the UI and enforcement layers stay aligned.

## Decision

### 1. Source of truth for “what the plan allows”

- **`plans`** and **`plan_limits`** define entitlements: feature keys, numeric caps, units (`count`, `mb`, etc.), and **reset intervals** (`day`, `month`, `billing_period`, `none`).
- **`subscriptions`** bind an organization to exactly one commercial plan row (`plan_id`) at a time for MVP flows we care about (`free`, `trialing`, `active`, …).
- Enforcement **always** uses server-side checks (`@ai-workspace-lab/entitlements`) before expensive or gated actions. The usage overview UI reads the same resolution logic so displayed limits match enforcement.

### 2. Reset windows vs Stripe billing period

- Limits with **`reset_interval = billing_period`** use the subscription’s **`current_period_start` / `current_period_end`** when present; otherwise entitlement code falls back to a calendar month (see `getCurrentBillingPeriod` in `@ai-workspace-lab/entitlements`).
- Limits with **`day`** or **`month`** use calendar boundaries independent of Stripe when those intervals are selected in `plan_limits`.
- Limits with **`reset_interval = none`** (e.g. a static max upload size in MB) are **not** tied to a counter period in the same way; the cap is always valid.

### 3. Usage measurement

- **Usage events** are append-only, idempotent records of billable or quota-relevant actions.
- **Usage counters** aggregate used quantity per organization, feature key, and **counter period** (`period_start`, `period_end`) aligned with the limit’s reset interval. The app increments counters when recording usage, not from the client.
- The **usage overview** page shows, for each plan limit, the **active period** (when applicable) and **used** quantity from the counter for that same period, so the UI matches quota math.

### 4. UI contract

- Route **`/app/[orgSlug]/usage`** is a **member-visible** summary: current plan, key limits, usage in period, subscription billing window when available, and a CTA to **billing** for upgrades (full Stripe flow is owned by the billing sprint).
- **No entitlements or quotas are enforced in the browser**; the page is read-only and server-rendered from trusted data.

## Consequences

- **Pros:** One mental model for support, product, and engineering: plan limits + subscription period + counters. UI and enforcement can be tested against the same data.
- **Cons:** New feature keys or limit types require updates to `plan_limits` seeding or admin tooling, and possibly new display rules in the usage overview.
- **Follow-up:** Detailed per-feature pages (`/usage/ai`, `/usage/documents`, …), platform admin usage views, and Stripe sync hardening are separate deliverables.
