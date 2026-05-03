# 0004 — Supabase auth end-to-end (email/password)

**Date:** 2026-W19
**Status:** Accepted
**Branch:** `feature/supabase-auth` → PR #10
**Commits:** 7fafdc6 (SSR clients) · 26e1652 (auth wired) · d13d973 (env fix) · cf871c3 (docs) · c17da57 (disabled-user loop fix)

## Why this entry exists

Phase 0 left us with 21 placeholder routes and a blank `packages/auth` package. This sprint wires Supabase email/password authentication all the way through: install the right packages in the right places, create the three Supabase factory functions Next.js 15 requires, replace the sign-in/sign-up placeholders with real forms, wire the email-confirmation callback, and guard the `/app` layout so unauthenticated users never reach the product.

Five commits. Two real bugs found during manual walkthrough. Everything documented below is a pattern you will encounter again in any SaaS that uses a session-cookie auth provider with a server-rendered framework.

---

## The three Supabase client files

The first architectural decision: three factory functions, one per runtime context.

```
apps/web/src/lib/supabase/
├── client.ts      ← browser (Client Components)
├── server.ts      ← server (Server Components, Route Handlers, Server Actions)
└── middleware.ts  ← edge (Next.js Middleware)
```

The reason is cookies. Supabase sessions live in cookies, and the API for reading and writing cookies is different in each context:

| Context | Cookie API | Supabase factory |
|---|---|---|
| Browser | `document.cookie` — browser handles it automatically | `createBrowserClient` |
| Server Component / Route Handler | `await cookies()` from `next/headers` | `createServerClient` with `getAll` / `setAll` |
| Middleware | `request.cookies` / `response.cookies` — no `next/headers` in Edge runtime | `createServerClient` with `request.cookies` |

Using the wrong factory in any context causes silent failures: the server client in the browser has no cookie access, so every user appears anonymous. The browser client in a Server Component doesn't exist — `document` is undefined on the server. The `next/headers` API isn't available in the Edge runtime where middleware runs.

**Next.js 15 note:** `cookies()` is now async. The server client factory must be `async` and call `await cookies()` before passing the store to `createServerClient`. Call sites that use it also become async — this cascades up the component tree, which is why the `/app` layout became `async`.

```typescript
// server.ts — the async is load-bearing in Next.js 15
export const createClient = async (): Promise<SupabaseClient> => {
  const cookieStore = await cookies();
  return createServerClient(url, key, { cookies: { getAll, setAll } });
};
```

### The middleware session-refresh rule

`apps/web/middleware.ts` calls `updateSession(request)` on every non-static request. Inside `updateSession`, the code is:

```typescript
const supabase = createServerClient(url, key, { cookies: { ... } });
// ↑ nothing between these two lines ↓
await supabase.auth.getUser();
return supabaseResponse;
```

This is not a style preference — it is a correctness rule. `getUser()` is what refreshes the access token and writes new cookies onto the response. Any redirect or response emitted *before* `getUser()` finishes will be missing the refreshed cookie. Result: users appear randomly logged out after their token expires, in a way that is nearly impossible to reproduce in development because tokens don't expire quickly there.

---

## The two-table user model

Supabase Auth manages `auth.users`. You cannot add columns to it. Your app needs `display_name`, `avatar_url`, `timezone`, `status`, `deleted_at`, and any future product fields. So the schema has two tables:

```
auth.users          ← owned by Supabase Auth; identity + credentials
public.users        ← owned by your app; everything the product needs
```

They are linked by `(auth_provider, auth_provider_user_id)` — **not** by `id = auth.users.id`. This distinction matters:

- If you link on `id`, future OAuth providers (Google, GitHub) can't reuse the same pattern cleanly.
- If you link on `(provider, provider_user_id)`, adding a new provider is a schema-free change. Each identity just gets its own row linked by its own `('google', google_uid)`.

The sync function `syncAuthUserToDatabase()` runs inside the `/app` layout on every visit:

```typescript
await db.insert(users)
  .values({
    authProvider: 'supabase',
    authProviderUserId: authUser.id,
    email: authUser.email,
    lastSeenAt: new Date(),
  })
  .onConflictDoUpdate({
    target: [users.authProvider, users.authProviderUserId],
    set: { email: ..., lastSeenAt: ... },
  });
```

### What the upsert payload deliberately excludes

The `status` column is not in the upsert payload. If it were, a disabled user signing in would reset themselves to `'active'` — the upsert would overwrite whatever an admin had set.

The rule: **only include columns that are safe to overwrite on every visit**. `status`, `created_at`, `deleted_at` are set once and never touched by the sync function. `email`, `display_name`, `avatar_url`, `last_seen_at` are safe to refresh.

---

## The email confirmation flow

```
User submits /sign-up
  → signUpAction calls supabase.auth.signUp()
  → Supabase creates auth.users row (email_confirmed_at = null)
  → Supabase sends email: http://localhost:3000/auth/callback?code=<one-time-code>

User clicks link
  → /auth/callback route handler
  → supabase.auth.exchangeCodeForSession(code) — trades the code for a real session
  → session cookies written onto the response
  → redirect to /app

/app layout runs
  → requireUser() → syncAuthUserToDatabase() → upserts public.users row
  → user is now fully on-boarded
```

The one-time code is valid for a short window and can only be used once. If `exchangeCodeForSession` fails (expired, already used), the route handler redirects to `/sign-in?error=auth_callback_failed` — never silently to a blank page.

---

## Open redirect — the bug in `/auth/callback`

The `next` query param lets the callback redirect to a specific destination after login:

```
/auth/callback?code=<valid>&next=/app/myorg/documents
```

Without validation, an attacker crafts:

```
/auth/callback?code=<valid>&next=//evil.com
```

The browser treats `//evil.com` as a protocol-relative URL (same scheme, different host). After the code is exchanged and the session cookie is written, the user is redirected to the attacker's domain — carrying their valid session.

The fix is two lines:

```typescript
const next = searchParams.get('next') ?? '/app';
const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app';
```

Must start with `/`. Must not start with `//`. This class of bug is called an **open redirect** and appears in almost every auth callback that accepts a caller-supplied destination URL. It is easy to miss because it doesn't crash anything — it just redirects somewhere you didn't intend.

---

## The disabled-user redirect loop

Found during manual testing. Sequence:

1. User's `status = 'disabled'`.
2. User visits `/app` → `requireUser()` checks status → redirects to `/sign-in?error=account_disabled`.
3. `/sign-in` page calls `getCurrentUser()` to check "already logged in?" → true → redirects to `/app`.
4. Back to step 2. **Infinite loop.**

The bug: `getCurrentUser()` was returning any user regardless of status. The fix: add `WHERE status = 'active'` to the query.

```typescript
// Before: returned disabled users
const [user] = await db.select().from(users).where(eq(users.id, authUser.id));

// After: treats disabled as "not logged in" for navigation purposes
const [user] = await db.select().from(users)
  .where(and(eq(users.id, authUser.id), eq(users.status, 'active')));
```

The design principle here: `getCurrentUser()` answers the question "is this person allowed to use the product right now?" — not "does a valid session exist?". Those are two different questions. `requireUser()` handles the case where the answer is "no" inside a protected route. `getCurrentUser()` on the sign-in page handles the "already logged in → skip the form" redirect. They need to agree on what "logged in" means, and for a SaaS that has account suspension, "logged in" must mean "active session AND active account."

---

## The missing INSERT RLS policy

Migration `0000` shipped with SELECT and UPDATE policies. INSERT was missing. This wasn't caught immediately because:

- The upsert uses the **anon-key server client** (not the service role key), so it is bound by RLS.
- When RLS blocks an INSERT, Postgres returns 0 affected rows — no error thrown, no exception in the ORM. It silently does nothing.
- The symptom was "the `public.users` row never appears after sign-up" — which looks like a data bug, not a permissions bug.

Migration `0001` added:

```sql
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (
    auth_provider = 'supabase'
    AND auth_provider_user_id = auth.uid()::text
  );
```

**The lesson:** when writing RLS, enumerate all four operations (SELECT, INSERT, UPDATE, DELETE) and make an explicit decision for each. The default is deny — but a silent deny on INSERT is one of the hardest bugs to diagnose because it produces no error, only a missing row.

---

## Server Actions vs API routes for auth

Sign-up, sign-in, and sign-out are implemented as Server Actions (`'use server'` functions called from form `action=`), not as `POST /api/auth/*` route handlers.

Why:

- **No manual `fetch`** — the browser POSTs directly to the action. No client-side JS required.
- **CSRF protection built-in** — Next.js validates the `Origin` header on Server Action calls. An API route would need an explicit CSRF token.
- **Progressive enhancement** — the form submits even without JavaScript.
- **Colocation** — the action lives in the same folder as the page, making the data flow obvious.

The tradeoff: Server Actions can only redirect or return serializable data, not stream arbitrary responses. For auth flows (which always end in a redirect), this is not a limitation.

---

## PostgREST schema cache — the local-dev gotcha

After running `pnpm db:migrate` locally, the app threw:

```
Error: Could not find the table 'public.users' in the schema cache
```

The table existed in psql. The cause: **PostgREST** (Supabase's REST layer) caches the database schema at startup. It doesn't notice new tables or new RLS policies until the cache is invalidated.

Fix — run after every migration in local dev:

```sql
NOTIFY pgrst, 'reload schema';
```

Or via the Supabase dashboard: **Database → API → Reload**. Supabase's hosted migration runner does this automatically; local dev does not. This produces a uniquely confusing error that looks like the migration didn't run — worth knowing before spending 20 minutes checking the migration file.

---

## Env var structure: server-only vs NEXT_PUBLIC_*

The Supabase project URL and publishable (anon) key were initially declared as server-only vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). They needed to move to `NEXT_PUBLIC_*` because the browser client factory (`client.ts`) runs in the browser — it can only read `NEXT_PUBLIC_*` variables.

| Variable | Client | Where it's used |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public, browser-safe | browser client, server client, middleware |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public, browser-safe | browser client, server client, middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only secret | admin operations only (bypasses RLS) |

The publishable key is called "anon" in the Supabase dashboard but "publishable" in the SSR library's env variable names. Both refer to the same key — it's safe in the browser because Supabase's security model is built around RLS, not around keeping the key secret. The service role key is different: it bypasses all RLS and must never reach a browser.

---

## What to internalize for future SaaS work

1. **Three cookie contexts = three clients.** Browser, server, middleware each have a different cookie API. The factory split is not optional.
2. **Middleware `getUser()` must run before any response.** Token refresh writes to cookies. A response without the refreshed token produces intermittent logout bugs.
3. **Two-table user model.** Auth provider owns its table; your product owns yours. Link on `(provider, provider_user_id)` not on `id = auth_user_id` for multi-provider readiness.
4. **Upsert payload discipline.** Status, created_at, and soft-delete columns belong on the INSERT path only. Never overwrite them on UPDATE.
5. **RLS deny is silent on INSERT.** Always enumerate SELECT, INSERT, UPDATE, DELETE explicitly. Missing INSERT policy → missing rows, no errors.
6. **Open redirect is one validation check.** Any callback that reads a destination URL from user input: must start with `/`, must not start with `//`.
7. **Auth vs. authorization.** A valid session ≠ an active account. Keep `getCurrentUser()` (product-level active check) distinct from the session check so navigation logic and access control agree.
8. **PostgREST schema cache.** After any local migration: `NOTIFY pgrst, 'reload schema'`.
