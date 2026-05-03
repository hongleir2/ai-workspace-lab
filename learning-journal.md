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
- Lint + format via **Biome** at root (originally landed as ESLint + Prettier; swapped same-week — see [learning-journal 0002](./docs/learning_journal/0002-tooling-switch-to-biome-and-playwright.md)).
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
