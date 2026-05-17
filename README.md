# ai-workspace-lab

Modular monolith for **AI Workspace SaaS + Desktop Companion**. Users upload documents, ask AI questions, get cited answers. Apps in `apps/`, shared code in `packages/`.

Full spec: [`docs/product/prd.md`](./docs/product/prd.md) · Routes: [`docs/product/frontend-page-map.md`](./docs/product/frontend-page-map.md) · Agent contract: [`CLAUDE.md`](./CLAUDE.md)

> **Current status:** Sprint 1 — Auth + tenant boundary done. See [`docs/contexts/README.md`](./docs/contexts/README.md) for the full done/in-progress/upcoming list.

---

## Prerequisites

- **Node ≥ 22.17** (`nvm use` picks it up from `.nvmrc`)
- **pnpm ≥ 10.4** (`corepack enable` installs the pinned version)
- **Docker Desktop** — required for local Supabase only

```bash
nvm use
corepack enable
pnpm install
```

---

## Environment setup

Environment variables live in `apps/web/.env.local` (gitignored). **Never edit it by hand** — pull from Vercel instead so local always matches what's deployed.

### First-time setup (Vercel CLI)

```bash
pnpm install                          # installs vercel CLI from devDependencies
pnpm vercel link                      # one-time: link this repo to your Vercel project
pnpm env:pull                         # pulls "Development" vars → apps/web/.env.local
```

After that, whenever env vars change in Vercel, run `pnpm env:pull` again.

### Vercel environment scoping

Configure these in **Vercel → Project → Settings → Environment Variables**, with different values per scope:

| Variable | Development (local) | Preview | Production |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:54322/postgres` | Supabase pooler URL (port 6543) | Supabase pooler URL (port 6543) |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI secret | Test webhook secret | Live webhook secret |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | *(leave unset — auto-resolved from `VERCEL_URL`)* | `https://ai-workspace-lab-web.vercel.app` |
| `SENTRY_ENVIRONMENT` | `development` | `preview` | `production` |

> **DATABASE_URL for Vercel:** use the **Transaction mode pooler** (port 6543) from Supabase → Project Settings → Database → Connection Pooling. Append `?pgbouncer=true`. The direct connection (port 5432) does not work reliably in serverless environments.

### Manual setup (no Vercel account)

Copy `.env.example` → `apps/web/.env.local` and fill in the values manually. Minimum required:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Database: local vs cloud

### Local Supabase (recommended for development)

Runs Postgres + Auth + Studio in Docker. No internet required. DB is throwaway — reset freely.

```bash
pnpx supabase start          # starts Docker stack; prints URLs + keys on first run
pnpx supabase status         # print URLs + keys any time after start
```

Copy the printed values into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

Then apply migrations and start the app:

```bash
pnpm --filter @ai-workspace-lab/db db:migrate
pnpm dev
```

Studio (table viewer + SQL editor) runs at `http://localhost:54323`.

### Cloud Supabase

Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Get credentials from **Project Settings → API** and **Project Settings → Database → Connection string**.

> Use **transaction mode** (port 6543) for `DATABASE_URL` with Next.js. Session mode (port 5432) is fine for migration scripts.

Fill `.env.local` with the project URL, anon key, service role key, and database URL, then:

```bash
pnpm --filter @ai-workspace-lab/db db:migrate
pnpm dev
```

---

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pkill -f "next dev"; pkill -f "turbo"` | Kill all lingering dev processes before a clean restart |
| `pnpm build` | Build all apps |
| `pnpm verify` | Full CI gate: lint + typecheck + test — must pass before push |
| `pnpm lint` | Lint and format-check (Biome) |
| `pnpm lint:fix` | Auto-fix lint and format issues |
| `pnpm typecheck` | TypeScript type-check all packages |
| `pnpm test` | Unit tests (Vitest) — no DB required |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm e2e:install` | Install Playwright browsers (one-time) |
| `pnpx supabase start` | Start local Supabase (Docker) |
| `pnpx supabase stop` | Stop local Supabase |
| `pnpx supabase db reset` | Wipe local DB and re-run all migrations |
| `pnpm --filter @ai-workspace-lab/db db:migrate` | Apply pending migrations |
| `pnpm --filter @ai-workspace-lab/db db:generate` | Generate migration from schema changes |

---

## Local verification checklist

Run this sequence after pulling a branch or completing a feature to confirm everything works end-to-end.

**Prerequisites:** Docker Desktop must be running before step 1.

```bash
# 1. Start local Supabase (first run pulls Docker images — takes ~60s)
pnpx supabase start

# If it was already running but stuck:
pnpx supabase stop && pnpx supabase start

# 2. Copy env (first time only) and fill in values from `pnpx supabase status`
cp .env.example .env.local
#   Required minimum:
#   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
#   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
#   NEXT_PUBLIC_APP_URL=http://localhost:3000

# 3. Apply all pending DB migrations
pnpm --filter @ai-workspace-lab/db db:migrate

# 4. (Optional) Seed plan data + Stripe price IDs
#   Set STRIPE_PRO_MONTHLY_PRICE_ID and STRIPE_PRO_YEARLY_PRICE_ID in .env.local first
pnpm --filter @ai-workspace-lab/db db:seed

# 5. Run unit tests (no DB needed)
pnpm test

# 6. Run integration tests (requires steps 1–3)
pnpm test:integration

# 7. Start the web app
pnpm dev
#   Web app → http://localhost:3000
#   Supabase Studio (table viewer) → http://localhost:54323

# If you get a stale connection error after changing DATABASE_URL or env vars,
# kill lingering processes first then rerun:
pkill -f "next dev" 2>/dev/null; pkill -f "turbo" 2>/dev/null
pnpm dev

# 8. Full CI gate — must be green before push
pnpm verify
```

**Verify a specific feature's DB changes:**

```bash
# Inspect a table's columns and constraints
pnpx supabase db psql -c "\d <table_name>"

# Wipe local DB and re-apply all migrations from scratch
pnpx supabase db reset
```

---

## Stripe / Billing (local setup)

Billing features require the Stripe CLI running alongside the dev server.

**One-time setup:**

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Log in (opens browser)
stripe login

# Forward webhooks to local dev server — prints a whsec_... signing secret
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Add to `.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_...           # Stripe dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...         # from stripe listen output above
STRIPE_PRO_MONTHLY_PRICE_ID=price_...  # Stripe dashboard → Products
STRIPE_PRO_YEARLY_PRICE_ID=price_...
```

**Test a checkout (frontend):**

1. `pnpm dev` in a separate terminal (keep `stripe listen` running)
2. Go to `/app/<org>/settings/billing` → click **Upgrade**
3. Use test card `4242 4242 4242 4242`, any future expiry, any CVC
4. Complete → lands on `/settings/billing/success`; cancel → `/settings/billing/canceled`
5. Watch `stripe listen` output — events appear as `[processed]`

**Test other events:**

```bash
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

**Test idempotency** — resend an event ID from the `stripe listen` output:

```bash
stripe events resend evt_xxx
```

Second delivery returns `{"received":true}` with no duplicate DB row.

Full details and SQL queries: [`docs/runbooks/stripe-webhook-runbook.md`](./docs/runbooks/stripe-webhook-runbook.md)

---

## Object storage — Cloudflare R2 (local dev)

Document uploads use a two-phase flow: the server creates a presigned URL (via `POST /api/orgs/[orgSlug]/documents`), and the browser PUTs the file directly to R2. You need either R2 or Supabase Storage configured for uploads to work.

### Option A — Cloudflare R2 (recommended)

**1. Create a bucket**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Storage & Databases → R2 → Overview**
2. Click **Create bucket** — e.g. `ai-workspace-lab-uploads`
3. Note your **Account ID** from the right sidebar

**2. Generate an API token**

1. On the R2 overview page click **Manage R2 API Tokens → Create API token**
2. Permission: **Object Read & Write**, scoped to your bucket
3. Copy the **Access Key ID** and **Secret Access Key** immediately — the secret is shown only once

**3. Set env vars**

Add to `apps/web/.env.local`:

```bash
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET=ai-workspace-lab-uploads
```

`NEXT_PUBLIC_R2_PUBLIC_URL` is optional — only needed if you expose the bucket via a public CDN domain.

**4. Configure CORS on the bucket**

The browser PUT goes directly to R2, so you must allow it. In the R2 dashboard go to your bucket → **Settings → CORS Policy**:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace `http://localhost:3000` with your production domain when deploying.

### Option B — Supabase Storage (zero extra config locally)

If you already have local Supabase running, this requires no new accounts:

```bash
STORAGE_PROVIDER=supabase
SUPABASE_STORAGE_BUCKET=documents   # create this bucket in Supabase Studio first
```

Create the bucket in Supabase Studio (`http://localhost:54323`) → **Storage → New bucket** → name it `documents`, set it to **Private**.

### Testing uploads

With storage configured:

1. `pnpm dev`
2. Go to `/app/<org>/documents` → click **Upload**
3. Pick a PDF, TXT, or MD file ≤ 5 MB → **Upload Document**
4. You should land on the document detail page with status `uploaded`

> If you see a CORS error in the browser console, double-check the CORS policy on the bucket matches your local URL exactly (including protocol and port).

---

## Observability (local dev)

### Sentry

Sentry is disabled by default locally (no DSN set). To test error capture:

1. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SENTRY_DSN=<DSN from sentry.io → Settings → Projects → Keys>
   SENTRY_ENVIRONMENT=development
   ```
2. Navigate to `/dev/sentry-test` — captures test client and server errors.
3. Check your Sentry project inbox to confirm events arrive.

### PostHog analytics + feature flags

PostHog drops all events silently when `NEXT_PUBLIC_POSTHOG_KEY` is not set — safe for local dev without a PostHog account.

To enable locally, add to `.env.local`:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...           # PostHog → Settings → Project → Project API key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # optional, this is the default
POSTHOG_PERSONAL_API_KEY=phx_...          # PostHog → Settings → Personal API keys
                                          # Scope: Local feature flag evaluation → Read
```

**Verify events are flowing:**
1. Sign up / sign in → open PostHog **Activity** tab and confirm `user_signed_up` / `user_signed_in`.
2. Navigate to `/app/<org>` → confirm `dashboard_viewed` + person identified.

**Test a feature flag locally:**
1. Go to **PostHog → Feature flags → `document_upload_enabled`**.
2. Add your user UUID (from the `users` table) as a test override.
3. Reload `/app/<org>` — the "Upload your first document" checklist item unlocks.

---

## Tests

**Unit tests** run without a database:

```bash
pnpm test
```

**Integration tests** (`*.integration.test.ts`) require a live Postgres. They are skipped automatically when `DATABASE_URL` is not set. To run them:

```bash
# Local
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres pnpm test

# Cloud (use session mode / port 5432 for direct connections)
DATABASE_URL=postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres pnpm test
```

---

## Repo layout

```
ai-workspace-lab/
├── apps/
│   ├── web/                   # Next.js 15 + Tailwind — main product
│   ├── desktop/               # Electron companion (scaffold)
│   └── e2e/                   # Playwright suite
├── packages/
│   ├── config/                # shared tsconfig presets
│   ├── types/                 # shared TS types (no runtime code)
│   ├── ui/                    # shared UI primitives
│   ├── db/                    # Drizzle ORM client + migrations
│   ├── auth/                  # auth helpers (scaffold)
│   ├── billing/               # Stripe billing: checkout, portal, webhook handler
│   ├── entitlements/          # plan/quota enforcement (scaffold)
│   ├── ai/                    # Vercel AI SDK + Anthropic helpers (scaffold)
│   ├── jobs/                  # async queue + retries (scaffold)
│   ├── email/                 # Resend transactional email (scaffold)
│   └── analytics/             # billing analytics stubs (PostHog wiring deferred)
├── docs/
│   ├── product/               # PRD, ERD, frontend page map, sprint plan
│   ├── adr/                   # architecture decision records
│   ├── contexts/              # living summaries for AI agents
│   ├── runbooks/              # incident response, ops procedures
│   └── journal/               # how we built each phase
├── CLAUDE.md                  # contract for AI agents working in this repo
├── .env.example               # all env vars with sprint labels
├── biome.json                 # lint + format config
└── turbo.json                 # Turborepo pipeline
```

> Packages marked *(scaffold)* have a `package.json` and placeholder `src/index.ts` but no logic yet. Implementation lands per-sprint per [`CLAUDE.md`](./CLAUDE.md).

---

## Stack (locked — changing any layer requires a new ADR)

| Layer | Choice |
|-------|--------|
| Web framework | Next.js 15 App Router + React 19 |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth |
| Payments | Stripe Checkout + Customer Portal |
| Email | Resend |
| Errors | Sentry |
| Analytics + flags | PostHog |
| Cache + rate limit + jobs | Upstash Redis + QStash |
| Object storage | Cloudflare R2 |
| AI | Vercel AI SDK + Anthropic Claude |
| Vector | pgvector in Supabase |
| Lint + format | Biome |
| Tests | Vitest (unit) + Playwright (e2e) |
| Monorepo | pnpm workspaces + Turborepo |

Full rationale: [`docs/adr/0001-stack-choice.md`](./docs/adr/0001-stack-choice.md)

---

## Conventions

- **Branches:** `feature/*`, `fix/*`, `chore/*`, `docs/*`, `adr/*`. Never commit to `main`.
- **Commits:** conventional prefix: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- **PRs:** `pnpm verify` must be green. New routes → update `frontend-page-map.md`. New tables → update ERD.
- **TS:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — all on. No `any`.
- **AI agents:** read [`CLAUDE.md`](./CLAUDE.md) before changing anything.
