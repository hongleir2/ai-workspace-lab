# 0005 — Authentication model

## Status

Accepted — 2026-05-03

## Context

[ADR 0001 §70](./0001-stack-choice.md) flagged a follow-up ADR — "Authentication model (Supabase Auth integration, session model, what is trusted server-side)" — that has been pending since the stack was picked. With the first auth-bearing surface (`apps/web` email/password sign-up + sign-in) about to merge in [PR #10](https://github.com/hongleir2/ai-workspace-lab/pull/10), the gap has to close before any product feature reads a user identity.

The constraints that actually bind the decision:

- **Multi-provider headroom from day one.** OAuth (Google/Apple) and possibly Clerk (per ADR 0001 §41) are likely follow-ups. The schema and helpers must not assume `id = auth.users.id`.
- **Next.js 15 + App Router + RSC.** Cookies are async; auth checks happen in server components, layouts, route handlers, and middleware — each with a different SSR contract.
- **Supabase RLS is the load-bearing tenant gate** (per [ADR 0004](./0004-database-access-layer.md)). RLS reads `auth.uid()` from the request JWT, so the server-side helper has to keep that JWT alive across the request.
- **One person, shipping product.** The model has to be obvious six months from now, with no clever middleware tricks that nobody remembers writing.

## Decision

We use **Supabase Auth** via `@supabase/ssr` for SSR-aware cookie handling, with our own `users` table joined to `auth.users` by a multi-provider composite key.

### Chosen provider

**Supabase Auth (email/password to start; OAuth providers added per-sprint as needed).** We do *not* use the deprecated `@supabase/auth-helpers-nextjs` — the supported package is `@supabase/ssr`. ADR 0001 §41 keeps "switch to Clerk in Phase 4" on the table; this ADR's contract (composite-key `users` table, server-side helpers as the trust boundary) is provider-agnostic and survives that swap.

### How Supabase users map to app users

The `public.users` table has its own `id uuid` and joins to `auth.users` via a **composite natural key**:

```sql
auth_provider              text not null   -- 'supabase' for now; 'google', 'apple', 'clerk' later
auth_provider_user_id      text not null   -- auth.users.id when provider='supabase'
unique (auth_provider, auth_provider_user_id)
```

We deliberately do **not** use `users.id = auth.users.id`. That shape is what most Supabase tutorials show, and it would be one less column — but it bakes a single-provider assumption into every foreign key in the schema. Multi-provider readiness is cheap if we pay for it now (one extra column, one extra index) and expensive if we pay for it later (rewriting every FK in a migration).

Provisioning: the row is created **lazily on first authenticated request**, not at the moment Supabase emits the `auth.users` row. The `/app` layout calls `requireUser()`, which `upsert`s on `(auth_provider, auth_provider_user_id)`. There is no Supabase webhook involved — the database is always self-healing because every protected-route hit re-asserts the row. Failure modes are bounded to "user clicks the email link" → "they see /app" with one round-trip; no out-of-band sync to break.

### Session model

Supabase Auth issues an HTTP-only, secure cookie. `@supabase/ssr` reads and refreshes that cookie on every server-side request via three thin wrappers:

| File                                                | Role                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/supabase/client.ts`               | Browser client. Reads the cookie. Used only when an interaction must run client-side.               |
| `apps/web/src/lib/supabase/server.ts`               | RSC / server-action / route-handler client. Cookies are async (Next 15) — `await cookies()`.         |
| `apps/web/src/lib/supabase/middleware.ts`           | Middleware client. Refreshes the session cookie on **every** request.                                |

`apps/web/middleware.ts` runs `updateSession(request)` first thing, so by the time any layout or route handler runs, the cookie is non-expired. **No code goes between `createServerClient(...)` and `supabase.auth.getUser()` in middleware** — any work in that gap can race with the refresh and produce phantom logged-out states. This invariant is documented inline in `middleware.ts` and re-asserted here because it has bitten every team that has ever used `@supabase/ssr`.

Email confirmation is **on** in dev. The flow is: `signUp` → confirmation email → `/auth/callback?code=…` → `exchangeCodeForSession(code)` → `/app`. Confirmation errors surface to `/sign-in?error=…` instead of silently redirecting (the agent's first version swallowed the error and produced confusing redirect loops; that bug is closed and called out in the smoke-test runbook).

### Server-side helpers

All trust decisions live in three functions in `apps/web/src/lib/auth/user.ts`:

| Helper                       | Returns                | Use it for                                                                                           |
| ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `getCurrentUser()`           | `User \| null`         | Soft check: "should I redirect this signed-in user away from `/sign-in`?" Returns the row only when `status = 'active'`. |
| `requireUser()`              | `User` (or redirects)  | Strict gate for protected routes. Calls `syncAuthUserToDatabase()` then asserts active. Redirects to `/sign-in` (no session) or `/sign-in?error=account_disabled` (status ≠ active). |
| `syncAuthUserToDatabase()`   | `User` (or redirects)  | Internal: upsert the auth user into `public.users`. Conflict target is `auth_provider,auth_provider_user_id`. **Does not write `status`** — the column default applies on first insert and is preserved on every later upsert. |

The two-helper split exists specifically to break a redirect loop: if both helpers used the same strict check, a disabled user landing on `/sign-in?error=account_disabled` would still satisfy "is signed in" → bounce to `/app` → bounce back to `/sign-in?error=…`, forever. The active-only filter on `getCurrentUser` makes that loop impossible.

Server-only callers always go through one of these three helpers. Feature code never imports `@supabase/supabase-js` directly to fetch the user.

### What the client can and cannot be trusted for

| Decision                                                | Where it must be made | Why                                                                                                                                  |
| ------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| "Is this user authenticated?"                           | Server                | The browser client reads the cookie too, but a forged or copy-pasted cookie can be sent from anywhere. Only the server-side `getUser()` (which validates the JWT against the auth service) is trustworthy. |
| "Is this user active / disabled / deleted?"             | Server                | Status lives in `public.users`. The browser never sees `users.status` directly.                                                       |
| "Can this user see organization X?"                     | Server (via RLS)      | RLS policies use `auth.uid()` from the request JWT. The server is the only place where the JWT exists.                                |
| "Show the email field as `you@example.com` placeholder" | Client                | Cosmetic. No trust boundary.                                                                                                          |
| "Disable the submit button while the action runs"       | Client                | UX. The server still re-validates whatever the action posted.                                                                         |

`@supabase/supabase-js` exposes `supabase.auth.getSession()` and `supabase.auth.getUser()` on the **browser**. Neither result is trustworthy for authorization — they answer "what does this client *think* it knows about its session," not "what does the server agree is true." The convention is: **never call `getSession()` on the server. Always call `getUser()`** — `getUser()` validates the JWT against the auth service; `getSession()` returns whatever is in the cookie. This is documented inline in `supabase/server.ts` and `supabase/middleware.ts`.

### Disabled / deleted user behavior

`public.users.status` is an enum: `'active' | 'disabled' | 'deleted'`. Supabase Auth **does not know about this column** — the auth service will happily issue a session token for a disabled user. The disabled-account guard lives entirely in our app layer:

- **Disabled** (`status = 'disabled'`): the auth session is left intact (Supabase still sees the user as valid). `requireUser()` redirects to `/sign-in?error=account_disabled` on every protected-route hit. `getCurrentUser()` returns `null`, so `/sign-in` and `/sign-up` render the form (with the destructive alert) instead of redirecting to `/app`. The user can sign back in — they just never reach a protected route until an admin flips the status. **Re-enable** is a manual `update users set status='active'`; the row's other fields are preserved.
- **Deleted** (`status = 'deleted'`, `deleted_at` set): same routing behavior as disabled (`requireUser()` redirects, `getCurrentUser()` returns null). The row is **kept**, not hard-deleted — every product table FKs into `users.id`, and orphaning those FKs is worse than carrying a tombstone row. The auth-side record in `auth.users` is also kept; revoking the underlying auth credential is a separate admin action (Supabase dashboard or admin API).
- **Re-signup of a deleted user**: not supported in MVP. The composite-key `(auth_provider, auth_provider_user_id)` on a fresh Supabase signup would be a new value (Supabase mints a new `auth.users.id`), so a new `public.users` row would be inserted alongside the tombstone. The old `email` is on the tombstone with a unique index — so the same email **cannot** be reused until that tombstone is cleaned up. If reuse becomes a real requirement, write an admin "purge tombstone" operation; do not relax the `email` unique index.

The full manual checklist for these flows lives in [`docs/runbooks/auth-smoke-test.md`](../runbooks/auth-smoke-test.md).

## Alternatives considered

- **`id = auth.users.id` schema (the Supabase tutorial shape).** Simpler, one fewer column, and 90% of Supabase docs assume it. Rejected because it locks the entire schema to a single auth provider — every product-table FK to `users.id` would have to be rewritten if we ever swap providers (per ADR 0001 §41, "Clerk in Phase 4" is on the table). The composite-key shape costs us one extra `text` column and one composite unique index; it buys provider mobility forever.
- **`@supabase/auth-helpers-nextjs`.** The original Next.js helper package. Rejected because it is officially deprecated in favor of `@supabase/ssr`; using it would mean migrating before the first product feature lands.
- **Provision the `users` row via a Supabase database webhook on `auth.users` insert.** Eager, mirrors the auth event in real time. Rejected because it adds an out-of-band sync path that can fail silently — if the webhook ever doesn't fire, the user has a session but no app row, and the failure mode is "first protected route 500s." Lazy upsert on `requireUser()` is self-healing: there is no state for the webhook to drift from.
- **Track disabled-state in `auth.users` via Supabase's `banned_until` column.** Plausible alternative for the disabled flag — Supabase Auth would refuse to issue tokens for a banned user, so the app layer wouldn't need to enforce. Rejected because (a) "deleted" still needs an app-side tombstone for FKs (per the section above), so we'd end up with a hybrid "banned in Supabase, deleted in app" model that is harder to reason about, and (b) we'd lose the ability to disable a user without revoking their auth session for audit purposes (e.g. "let them sign in but show them an explainer page" — a future product surface).
- **Trust `supabase.auth.getSession()` on the server for performance.** `getSession()` skips the auth-service round-trip. Rejected outright — `getSession()` returns whatever is in the cookie. On the server, we always call `getUser()` so the JWT is validated against the auth service. The cost is one network hop per request; the alternative is a class of bugs where a stale or forged cookie passes auth checks.

## Consequences

- **What gets easier:**
  - Adding a second auth provider (OAuth Google, Clerk) is a new `auth_provider` value plus a corresponding sign-in flow — no schema migration on `users` or any product table.
  - Trust decisions are localized: three helpers in `apps/web/src/lib/auth/user.ts`, one middleware file, three Supabase client wrappers. A reviewer can see every place auth is enforced in five files.
  - Lazy provisioning means there is no auth/db sync to monitor or replay. Either the user has a session and a row, or `requireUser()` heals it on the next request.
  - Disabled/deleted behavior is a single column read in the helper. Admin operations are plain SQL — no Supabase admin API call needed for status flips.
- **What gets harder:**
  - Composite-key joins are slightly more verbose than `users.id = auth.users.id`. We accept it; the type-level cost is contained in `syncAuthUserToDatabase()` and never leaks into product code.
  - Every protected-route hit does an upsert. For MVP traffic this is free; if we ever get to "thousands of requests per second to the same user's pages," we'll cache the user row in a per-request memo (RSC's request-scoped `cache()` is the obvious tool). Premature today.
  - Server-side `getUser()` adds one network hop to every protected request. Acceptable for MVP; if it becomes a latency problem, the fix is a per-request memo *of the validated user object*, not a switch to `getSession()`.
- **Trade-offs we accept:**
  - We accept that disabled-state enforcement is application-layer, not auth-layer. A bug in the helper would let a disabled user reach a protected route. Mitigation: the smoke-test runbook has a regression scenario that catches exactly this; future Playwright e2e codifies it.
  - We accept the email-uniqueness-blocks-deleted-resignup constraint as MVP behavior. Documented above; revisit only when product asks for "let me sign up again with the same email."
  - We accept Supabase Auth as the dependency surface for now. Per ADR 0001 §41, Clerk remains a Phase 4 option if org/RBAC UI cost gets out of hand. The composite-key schema and three-helper trust boundary survive that swap; the migration would be a new sign-in/up flow plus a backfill of `auth_provider='clerk'` rows.

## Follow-up work

- [ ] Wire a UI sign-out control in `apps/web` (action exists; no button yet).
- [ ] OAuth providers (Google first) — separate ADR if the provider semantics differ enough; otherwise a sprint task.
- [ ] Password reset / magic link flows.
- [ ] Per-request memo of the validated user object inside RSC (`React.cache` around `requireUser`) once a real latency signal exists.
- [ ] Playwright e2e suite codifying `docs/runbooks/auth-smoke-test.md` — including the disabled-account regression check.
- [ ] Admin operation for "purge tombstone" if/when product asks for deleted-user re-signup.
- [ ] Decide on JWT-context propagation pattern for RLS-aware queries from RSC (already tracked as a known TODO in `packages/db/README.md` per ADR 0004's follow-ups).
