# @ai-workspace-lab/web

The primary web app for AI Workspace SaaS.

> **Status:** Phase 0 scaffold. Next.js 15 (App Router) + React 19 + Tailwind 3.4. No product features — see [PRD](../../docs/product/prd.md).

## Develop

```bash
pnpm --filter @ai-workspace-lab/web dev
# or from repo root
pnpm dev
```

App runs at <http://localhost:3000>.

## What's wired

- App Router (`src/app/`)
- Tailwind v3.4 (PostCSS pipeline, content scoped to `src/**`)
- Strict TS via `@ai-workspace-lab/config/tsconfig.base.json`

## What's NOT wired (deferred)

- Auth (`@ai-workspace-lab/auth` + Supabase)
- DB client (`@ai-workspace-lab/db`)
- Billing, entitlements, AI, jobs, email, analytics — separate workspace packages, none wired in yet
- Sentry, PostHog
