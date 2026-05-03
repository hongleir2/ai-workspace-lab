# 0002 — Tooling switch: Biome (replaces ESLint + Prettier) & Playwright e2e

**Date:** 2026-W18
**Supersedes:** lint/format sections of [0001](./0001-phase-0-foundation.md)
**Status:** Accepted

## Why this entry exists

[`CLAUDE.md`](../../CLAUDE.md) flags `eslint.config.mjs` and `tsconfig.base.json` as do-not-change-without-justification boundaries: *"Affects every package. A loosening must be justified in PR."* Swapping the entire lint/format toolchain is a much bigger change than loosening a rule, so it gets its own learning-journal entry rather than a quiet refactor.

This doc captures **(a)** the switch from ESLint + Prettier → Biome, and **(b)** the addition of Playwright as the e2e test runner. Both happened in the same Phase-0 maintenance pass.

---

## Part 1 — ESLint + Prettier → Biome

### What changed

| Before                                                                    | After                            |
| ------------------------------------------------------------------------- | -------------------------------- |
| `eslint` + `@eslint/js` + `typescript-eslint` + `eslint-config-prettier`  | `@biomejs/biome`                 |
| `prettier`                                                                | (folded into Biome)              |
| `eslint.config.mjs` + `prettier.config.mjs` + `.prettierrc` + `.prettierignore` | `biome.json`                |
| `pnpm format` / `pnpm format:check` / `pnpm lint` (three steps)           | `pnpm lint` (one step)           |
| Per-package `lint` script orchestrated by Turbo                           | Single root pass — Biome is fast enough |

### Why switch

1. **Speed.** Biome is written in Rust and operates on its own AST. On this repo (handful of files) the diff is invisible, but on a real product tree it's roughly an order of magnitude faster than ESLint with type-aware rules. That matters because `pnpm verify` runs on every PR and locally before each push.
2. **One tool, one config.** `eslint.config.mjs` + `prettier.config.mjs` + `eslint-config-prettier` (to disable formatter conflicts) is three moving parts to keep in sync. Biome unifies lint + format with a single schema.
3. **Fewer dependencies.** ESLint pulls a long transitive tree; Biome ships as a single binary. Less surface for supply-chain pain, faster CI installs.
4. **It removed an actual papercut.** During Phase-0 setup, ESLint's type-aware rules tried to parse `.mjs` config files and threw "not found by the project service." We worked around it by scoping `recommendedTypeChecked` to `**/*.ts(x)` only. Biome has no such concept — that whole class of bug disappears.

### What we accept losing

This is the honest trade-off. Biome's TS lint rules are **not** type-aware. Specific rules from `typescript-eslint` we no longer have:

- `no-floating-promises` — flags an unawaited `Promise` that nobody handles.
- `await-thenable` — flags `await` on a non-promise.
- `no-misused-promises` — flags passing an `async` function where a sync handler is expected (e.g., `<button onClick={asyncFn}>`).
- `require-await`, `no-unnecessary-type-assertion`, `no-unsafe-*` family.

These are real wins ESLint gives you. We're betting that:

1. **`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`** in tsconfig already catch most of the dangerous shapes.
2. **`pnpm typecheck`** still runs in CI and locally — `tsc` itself catches `await` on non-promises and many promise-mishandling patterns.
3. We'll add a **post-Phase-0 ADR** to revisit if we notice floating-promise bugs in production. If we do, we layer ESLint back on top of Biome (Biome explicitly supports running alongside ESLint) for *only* those rules. That's a future decision driven by evidence, not preemptive scaffolding.

### Switch trigger (when to revisit)

- Multiple production incidents traceable to floating promises, unhandled rejection, or misused async event handlers.
- Biome team announces type-aware rules (on their roadmap as of late 2025) — opportunity to remove the "what we lose" caveat entirely.
- Team grows past one person — opinions on tooling will be stronger; revisit is cheap.

### Alternative tools considered (ranked)

| Tool                       | Verdict                | Reason                                                                                                           |
| -------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Biome 1.9.4**            | Chosen                 | Single binary, fast, sane defaults, active development, VS Code extension first-class.                           |
| ESLint 9 + Prettier 3      | Previous setup (0001)  | Best ecosystem, type-aware rules. Loses on speed and config-tax for a one-person repo.                           |
| Oxc (oxlint + oxfmt)       | Watching               | Faster than Biome, but as of early 2026 the formatter is still in active development. Revisit late 2026.         |
| Deno fmt / Deno lint       | No                     | Strong tools but ecosystem assumes Deno runtime; we're on Node + pnpm.                                           |
| Rome (predecessor)         | Discontinued           | Project is dead; Biome is its fork.                                                                              |

### Files touched in this switch

**Added**
- `biome.json` (root config)

**Removed**
- `eslint.config.mjs` (root) — was a one-line re-export of the shared config
- `packages/config/eslint.config.mjs`
- `packages/config/prettier.config.mjs`
- `.prettierrc`
- `.prettierignore`

**Edited**
- `package.json` — dropped `eslint`, `@eslint/js`, `prettier`, added `@biomejs/biome`. Scripts: `lint` → `biome check .`, `lint:fix` → `biome check --write .`, `format`/`format:check` → folded into `lint`. `verify` simplified to `lint && typecheck && test`.
- `packages/config/package.json` — dropped `eslint-config-prettier`, `typescript-eslint`, `@eslint/js`. Removed `./eslint` and `./prettier` exports. (Could be deleted entirely, but `tsconfig.base.json` still lives there, so the package stays.)
- `turbo.json` — removed the `lint` task. Biome runs at root in a single pass; no per-package fan-out needed.
- `.github/workflows/ci.yml` — collapsed "Format check" + "Lint" into one `pnpm lint` step.
- `CLAUDE.md`, `README.md`, `learning-journal.md` — command tables and prose updated.

### What did NOT change

- TypeScript strict flags — still on. Biome respects them implicitly via the language server; tsc enforces them.
- `tsconfig.base.json` — untouched.
- `pnpm verify` is still the one gate that matters. Just with fewer steps inside it.

---

## Part 2 — Playwright e2e

### Why now

Phase 0 is "engineering amplifier only." We have zero apps, so there's nothing meaningful to e2e *test* yet. But we add the harness now because:

1. The first app (Next.js) lands next sprint. If Playwright is wired up in advance, the first e2e arrives the same day as the first feature.
2. Playwright's installer is heavy (~200MB of browsers). Doing it once now, in a quiet sprint, is better than doing it under feature pressure.
3. CI gate shape: when product code starts landing, we want PRs to fail fast on broken user flows, not just unit tests.

### Setup chosen

- **`@playwright/test` as the runner** — not `playwright` directly. The `@playwright/test` package gives us the test runner, parallel workers, fixtures, and trace viewer in one.
- **Lives at `apps/e2e/`** — a workspace package with its own `package.json`, `playwright.config.ts`, and `tests/`. Treating e2e as a first-class app (not a folder buried in another package) keeps it agnostic to which product app it points at.
- **No app under test yet** — config has `webServer` commented out and `baseURL` set to a placeholder. A single smoke test (`tests/smoke.spec.ts`) asserts `expect(true).toBe(true)` so the harness runs green in CI without needing a server.
- **Browsers: chromium-only by default**. Firefox + WebKit are commented in `playwright.config.ts`; flip them on per-app if cross-browser matters. Default keeps CI fast.
- **Wired into CI via a separate job**, not the main `pnpm verify` gate — Playwright installs browsers, which is too slow to run on every typecheck. The e2e job runs in parallel to the verify job.

### What we accept

- Playwright lock-in for now. Alternatives (Cypress, WebdriverIO) are viable but Playwright has won on speed, parallelism, and trace viewer DX. Switch trigger: would need a *very* compelling reason; this is a minor risk.
- e2e tests aren't part of `pnpm verify` — that script stays fast. Run `pnpm e2e` explicitly, or rely on CI.

### Files added

- `apps/e2e/package.json` — workspace package `@ai-workspace-lab/e2e`.
- `apps/e2e/playwright.config.ts` — chromium project, traces on first retry, html reporter.
- `apps/e2e/tests/smoke.spec.ts` — one passing assertion to prove the harness works.
- `apps/e2e/tsconfig.json` — extends `@ai-workspace-lab/config/tsconfig.base.json`.
- `.github/workflows/e2e.yml` — separate CI job with browser cache.
- Root `package.json` — adds `e2e` and `e2e:install` scripts.

### Switch trigger (when to revisit Playwright)

- We adopt a framework that ships its own e2e blessed (e.g., a future Next.js bundle). Unlikely to beat Playwright today.
- We need real-device testing on iOS/Android — Playwright's mobile emulation is fine but not a real device farm. Look at BrowserStack/Sauce Labs at that point.

---

## Outcome

`pnpm verify` is still green after the switch:

```
pnpm lint       # biome check . — replaces format:check + eslint
pnpm typecheck  # unchanged
pnpm test       # unchanged (vitest)
```

`pnpm e2e` (new) runs the Playwright suite. Currently one smoke test, expected to grow as apps land.

The repo is one tool lighter, one test layer richer, and the trade-offs are documented for future-me to argue with.
