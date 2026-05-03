# Learning journal

Weekly reflection. Commit at least one entry per week. Keep entries terse — what shipped, what surprised, what is now on the "I should understand this better" list.

Format:

```
## YYYY-WW — Phase N · headline

**Shipped**
- ...

**Surprised by**
- ...

**Need to understand better**
- ...

**Next week**
- ...
```

---

## 2026-18 — Phase 0 · foundation

**Shipped**

- `ai-workspace-lab/` monorepo (pnpm workspaces + Turborepo).
- Strict TS base (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) in `@ai-workspace-lab/config`.
- Lint + format via **Biome** at root (originally landed as ESLint + Prettier; swapped same-week — see [journal 0002](./docs/journal/0002-tooling-switch-to-biome-and-playwright.md)).
- Vitest at workspace root, picking up tests from every package's `src`.
- **Playwright** e2e harness at `apps/e2e/` (smoke spec only; first real flows arrive with `apps/web`).
- GitHub Actions CI: lint → typecheck → test, plus a parallel Playwright job.
- ADR 0001 locks the default stack (Next.js, Supabase, Stripe, Resend, Sentry, PostHog, Upstash, R2, Vercel AI SDK + Claude, pgvector).
- `CLAUDE.md` defines branch naming, commands, ADR location, and "do not change without test" boundaries.

**Surprised by**

- ESLint's type-aware rules tripped on `.mjs` config files; the workaround (scoping type-aware presets to `**/*.ts(x)` only) was the kind of meta-config friction that pushed us to Biome.
- Biome's defaults are close enough to our Prettier config that the mass reformat was nearly a no-op — only a handful of files re-flowed.

**Need to understand better**

- Turborepo's `dependsOn: ["^build"]` graph and how that shapes test ordering.
- Biome's lint rule taxonomy (`suspicious` / `style` / `correctness` / `complexity` …) — what's covered vs. what we lose without type-aware rules.
- pnpm's `workspace:*` resolution semantics when a package gets published.
- Playwright's trace viewer + `webServer` lifecycle; how to wire it to `apps/web` once that exists.

**Next week (Phase 1)**

- Decide first product: AI Workspace web app (per the long-form PRD).
- Write ADR 0002 (auth model) and ADR 0003 (multi-tenant data model).
- Stand up `apps/web` with Supabase Auth + protected dashboard + organization creation.

---

## 2026-19 — Phase 1 · Supabase auth end-to-end (PR #10)

**Shipped**

- `@supabase/ssr` + `@supabase/supabase-js` installed in the right packages.
- Three Supabase factory functions: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server components / route handlers), `lib/supabase/middleware.ts` (session refresh).
- `apps/web/middleware.ts` runs the session refresh on every non-static request.
- Server Actions for `signUpAction`, `signInAction`, `signOutAction`.
- `/sign-in` and `/sign-up` pages with redirect-when-already-signed-in.
- `/auth/callback` route handler that exchanges the email-confirmation code for a live session.
- `/app` layout guarded by `requireUser()`, which auto-syncs `auth.users` → `public.users` on every visit.
- Migration `0001` adding the INSERT RLS policy that was missing from `0000`.
- Auth smoke-test runbook at `docs/runbooks/auth-smoke-test.md`.
- Two bug fixes found during manual walkthrough: open-redirect in callback, disabled-user redirect loop on `/sign-in`.

---

### Why three Supabase client files?

Supabase needs to read and write session cookies. Where cookies live depends on *where your code runs*:

| File | Where it runs | Cookie access |
|---|---|---|
| `client.ts` | Browser (Client Components) | Browser's native `document.cookie` — `createBrowserClient` handles it |
| `server.ts` | Server Components, Route Handlers, Server Actions | `next/headers` `cookies()` store — must `await cookies()` in Next.js 15 |
| `middleware.ts` | Next.js Edge Middleware | `request.cookies` / `supabaseResponse.cookies` — no `next/headers` available here |

If you used the browser client in a server component, the server would have no cookie access and every user would appear anonymous. If you used the server client in middleware, `next/headers` isn't available in the Edge runtime. The split is not optional — each context genuinely has a different API for cookies.

The rule inside `middleware.ts`:  **no code between `createServerClient(...)` and `await supabase.auth.getUser()`**. The token refresh writes new cookies; any redirect or response you emit before `getUser()` finishes will be missing the refreshed cookie, causing users to appear randomly logged out on subsequent requests.

---

### Why two users tables — `auth.users` and `public.users`?

Supabase Auth manages its own `auth.users` table which you cannot extend. But your app needs extra columns — `display_name`, `avatar_url`, `timezone`, `status`, `deleted_at`. So the standard pattern is:

1. `auth.users` — owned by Supabase Auth. Contains identity and credential data. Never touch it directly from app code.
2. `public.users` — owned by your app. Linked via `(auth_provider, auth_provider_user_id)`. Contains everything the product needs.

The `syncAuthUserToDatabase()` function upserts a row in `public.users` on every `/app` layout render. The composite key `(auth_provider, auth_provider_user_id)` — not `id = auth.users.id` — is what makes the schema multi-provider ready. A future Google OAuth login gets its own row linked by `('google', google_user_id)` without any schema change.

**Critical detail on the upsert payload**: the `status` column is intentionally excluded. If a user is disabled (`status = 'disabled'`) and signs in again, you do not want the upsert to reset them to `'active'`. Only the INSERT path (first sign-in ever) touches `status`, via the column default. The UPDATE path touches only safe fields (`email`, `display_name`, `avatar_url`, `last_seen_at`).

---

### The email confirmation flow step-by-step

1. User submits `/sign-up` form → `signUpAction` calls `supabase.auth.signUp()`.
2. Supabase creates a row in `auth.users` with `email_confirmed_at = null` and sends an email with a link: `http://localhost:3000/auth/callback?code=<one-time-code>`.
3. User clicks the link → `/auth/callback` route handler runs.
4. `supabase.auth.exchangeCodeForSession(code)` trades the one-time code for a real session and writes the session cookies onto the response.
5. Route handler redirects to `/app`. The `/app` layout calls `requireUser()`, which calls `syncAuthUserToDatabase()`, upserts the row, and returns it.

The `code` is valid once and expires quickly. If `exchangeCodeForSession` fails (expired, already used), you redirect to `/sign-in?error=auth_callback_failed` instead of silently landing on a blank page.

---

### The open-redirect bug in `/auth/callback`

The `next` query param lets the callback redirect to a specific page after login:
`/auth/callback?code=…&next=/app/myorg/documents`

Without validation, an attacker could craft:
`/auth/callback?code=<valid>&next=//evil.com`

The browser interprets `//evil.com` as a protocol-relative URL and navigates there after the code is exchanged — taking the valid session with it. The fix is a two-line check:

```typescript
const next = searchParams.get('next') ?? '/app';
const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app';
```

This is a class of bug called an **open redirect** — common in any auth callback that trusts a caller-supplied destination URL. Always validate: must start with `/`, must not start with `//`.

---

### The disabled-user redirect loop

An unexpected bug found during manual testing. The sequence:

1. User's status is `'disabled'`.
2. User visits `/app` → `requireUser()` reads status → redirects to `/sign-in?error=account_disabled`.
3. `/sign-in` page calls `getCurrentUser()` to check "is this user already logged in?" → if yes, redirect to `/app`.
4. `getCurrentUser()` was returning the user regardless of status → it returned the disabled user → redirected to `/app` → back to step 2. **Infinite loop.**

The fix: `getCurrentUser()` filters `WHERE status = 'active'`. The contract becomes: "getCurrentUser returns a user only if they are allowed to use the product." Disabled rows are treated as "not logged in" for the purpose of navigation decisions. `requireUser()` remains the canonical gate that explains *why* access is denied.

This is a subtle SaaS design point: **authentication** (are you who you say you are?) and **authorization** (are you allowed in?) are separate questions. Supabase handles authentication. Your app code handles authorization — and the two can give conflicting answers for disabled accounts.

---

### Why Server Actions instead of API routes?

Server Actions (`'use server'` functions called from forms) handle auth mutations here instead of `POST /api/auth/sign-in`. Reasons:

- **No manual `fetch`**: the form's `action={signInAction}` wires directly. The browser sends a POST to Next.js's internal handler.
- **CSRF built-in**: Next.js validates the `Origin` header on Server Action calls. An API route would need an explicit CSRF token.
- **Progressive enhancement**: the form works without JavaScript (useful for low-connectivity scenarios, though less critical in a SaaS).
- **Same file as the UI**: the action and the page are colocated, making the data flow obvious.

The tradeoff: Server Actions can only redirect, not stream arbitrary responses. For auth this is fine — you always redirect after sign-in/sign-up.

---

### The missing INSERT RLS policy (found in production)

Migration `0000` shipped with two RLS policies: `SELECT` (read own row) and `UPDATE` (update own row). It was missing the INSERT policy. This wasn't caught immediately because:

- The `syncAuthUserToDatabase()` upsert runs using the **server client** (the publishable/anon key), not the service role key.
- The server client is bound by RLS policies just like a browser client.
- Without an INSERT policy, the first upsert silently fails (Postgres returns an empty result, not an error, when RLS blocks an insert).

The fix: migration `0001` adds:
```sql
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth_provider = 'supabase' AND auth_provider_user_id = auth.uid()::text);
```

**Lesson**: when writing RLS, explicitly enumerate all four operations (SELECT, INSERT, UPDATE, DELETE) and decide for each. An omitted policy means "deny" — but the deny is silent on INSERTs in some client libraries, making it look like a data bug rather than a permissions bug.

---

### PostgREST schema cache — the invisible gotcha

After running a migration locally (`pnpm db:migrate`), the app threw `"Could not find the table 'public.users'"` even though the table existed in psql. The cause: **PostgREST** (the REST layer Supabase uses) caches the database schema at startup and doesn't auto-reload it.

The fix is to run after every migration:
```sql
NOTIFY pgrst, 'reload schema';
```

Or trigger it from the Supabase dashboard: Database → Extensions → reload. This is a local-dev friction point only — Supabase's hosted migrations run this automatically. But it's important to know because it produces a confusing error that looks like the migration didn't run.

---

### What to internalize for future SaaS work

1. **Three cookie contexts = three clients.** Any time you use a session-cookie-based auth library in Next.js, you need separate factory functions for browser, server, and middleware.
2. **Two-table user model is standard.** Your product table and the auth provider's table are always separate. Sync with an upsert keyed on the provider identity.
3. **Upsert payload = only what's safe to overwrite.** Never blindly upsert every column — think through which fields should only be set on INSERT (status, created_at) vs. which are safe to refresh (email, display_name).
4. **RLS is explicit deny by default.** List every operation. Silent INSERT failures are hard to debug.
5. **Open redirect is trivially easy to introduce.** Any redirect that reads a URL from user input (query param, form field) needs the `/` prefix check.
6. **Auth + authorization are separate.** A valid session doesn't mean the account is enabled. Keep `getCurrentUser()` (product-level "is this person active?") distinct from the raw session check.
7. **Middleware session refresh is load-bearing.** Skipping it or putting code before `getUser()` causes intermittent auth failures that are very hard to reproduce.
