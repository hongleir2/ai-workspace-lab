# Auth smoke test

Manual verification of the email/password auth surface (`apps/web`). Run this checklist after
changes to:

- `apps/web/src/app/(auth)/**`
- `apps/web/src/app/auth/callback/**`
- `apps/web/src/app/app/layout.tsx`
- `apps/web/src/lib/auth/**`
- `apps/web/src/lib/supabase/**`
- `apps/web/middleware.ts`
- `packages/db/migrations/*users*` or any RLS change on `public.users`

The same checklist is the source of truth for the eventual Playwright e2e suite at
`apps/e2e/tests/auth.spec.ts` — each numbered scenario maps to one `test(...)` block.

## Symptom → likely cause cheat sheet

| Error you see                                                     | Likely cause                                                                                    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Invalid environment variables: NEXT_PUBLIC_APP_URL …`            | `apps/web/.env.local` missing or unreadable — copy from repo root `.env.local`                  |
| `Failed to sync app user: Could not find the table 'public.users'` | Migration not applied to the target DB, or PostgREST schema cache stale (see `packages/db/README.md` § Migration flow step 6) |
| `42501 row-level security policy …` on first sign-in              | INSERT policy missing or scoped wrong — verify `users_insert_own` exists with provider scoping  |
| Sign-up redirects but no confirmation email arrives               | "Confirm email" toggle off in Supabase, or Resend domain not verified                           |
| Confirmation link redirects to `localhost:3000/?code=…` (root)    | Site URL or Redirect URLs misconfigured in Supabase                                             |

## Prerequisites

One-time setup per fresh Supabase project:

1. **Authentication → Providers → Email**: "Confirm email" **ON**.
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs (add): `http://localhost:3000/auth/callback`
3. **Apply migrations** (see `packages/db/README.md` for env-loading caveats):
   ```bash
   ln -sf ../../.env.local packages/db/.env   # one-time
   pnpm --filter @ai-workspace-lab/db db:migrate
   ```
4. **Reload PostgREST schema cache** (run in SQL editor):
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
5. **Start the dev server**:
   ```bash
   pnpm --filter @ai-workspace-lab/web dev
   ```

## Scenarios

### 1. Sign-up happy path

**Steps**

1. Navigate to `http://localhost:3000/sign-up`.
2. Submit a fresh email + password (≥ 8 chars).
3. Open the confirmation email and click the link.

**Expectations**

- After submit: redirected to `/sign-in?message=check_email`; "Check your inbox" alert visible.
- After clicking the email link: redirected to `/auth/callback?code=…`, then to `/app`.
- In Supabase → Table Editor → `users`: a new row exists with
  - `auth_provider = 'supabase'`
  - `auth_provider_user_id` matches the corresponding `auth.users.id`
  - `email` matches the form input (case-insensitive — `citext`)
  - `status = 'active'`
  - `last_seen_at` recent

**Playwright equivalent**: programmatic confirmation via the Supabase admin API (otherwise the test
needs an SMTP fixture). Use `supabase.auth.admin.generateLink({ type: 'signup', … })` to fetch the
confirmation URL directly instead of polling a mailbox.

### 2. Sign-out

**Steps**

1. From `/app`, invoke `signOutAction` (no UI button yet — call from the browser console:
   `await fetch('/sign-out', { method: 'POST' })` once the action is wired to a route, or clear
   the `sb-*` cookies).
2. Navigate to `/app`.

**Expectations**

- Step 2 redirects to `/sign-in`.

### 3. Sign-in (returning user)

**Steps**

1. From `/sign-in` enter the credentials from scenario 1.
2. Submit.

**Expectations**

- Lands on `/app`.
- The same `users` row is reused: `last_seen_at` is bumped, `status` remains `active`, and **no
  duplicate row** is created.

### 4. Redirect-when-signed-in

**Steps**

While signed in:

1. Visit `/sign-in`.
2. Visit `/sign-up`.

**Expectations**

- Both redirect to `/app` without rendering the form.

### 5. Bad inputs

**Steps + expectations**

| Input                                  | Expected outcome                                                  |
| -------------------------------------- | ----------------------------------------------------------------- |
| `/sign-up` with password length < 8    | Browser-native HTML5 validation blocks submit (no server hit).    |
| `/sign-in` with wrong password         | Redirects to `/sign-in?error=…`; red destructive alert renders.   |
| `/sign-up` with already-registered email | Redirects to `/sign-in?error=…` (Supabase: "User already registered"). |

### 6. Open-redirect blocked

**Steps**

Navigate to each URL in turn:

1. `http://localhost:3000/auth/callback?code=anything&next=//evil.com`
2. `http://localhost:3000/auth/callback?code=anything&next=/\evil.com`
3. `http://localhost:3000/auth/callback?code=anything&next=https://evil.com`

**Expectations**

- All three never leave `localhost:3000`. The bogus code triggers a redirect to
  `/sign-in?error=…`; the `next` param is discarded because it fails the `safeNext()` allow-list
  in `apps/web/src/app/auth/callback/route.ts`.

**Why this matters**: this is the security blocker fixed in PR #10. Regression here is a real
phishing vector — keep this test.

### 7. Disabled-account guard

**Steps**

1. In Supabase → Table Editor → `users`: change the row's `status` from `active` to `disabled`.
2. Sign out.
3. Sign back in with the same credentials.

**Expectations**

- Step 3 redirects to `/sign-in?error=account_disabled`; the alert reads "Your account has been
  disabled. Please contact support."
- The DB row's `status` remains `disabled` — `syncAuthUserToDatabase` must **not** silently flip
  it back to `active`. (This is the bug fixed when `status: 'active'` was removed from the upsert
  payload; the column default only applies on first insert.)

**Cleanup**: flip `status` back to `active` if you want to keep using the account.

## Two-minute confidence smoke test

If you only have a couple of minutes — for example, before merging an unrelated PR that touches
shared auth code — run scenario **1** (sign-up + confirm) and **7** (disabled-account guard).
Together they exercise the full sync path and prove both critical security fixes still hold.
