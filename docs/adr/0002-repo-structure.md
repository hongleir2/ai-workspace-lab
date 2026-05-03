# 0002 — Repo structure: pnpm workspaces + Turborepo

## Status

Accepted — 2026-05-02

## Context

`ai-workspace-lab` ships a web app and a desktop companion that share types, UI primitives, and back-end logic (auth, billing, entitlements, AI helpers, jobs, email, analytics). Two reasonable ways to organize this:

1. Multiple repos (one per app, plus shared libs published to a private registry).
2. A single repo with internal package boundaries.

For an indie / small-team product, the cost of multi-repo is real: every shared change is a multi-PR dance, version drift creeps in, and CI gets slower because each repo re-installs the world. We want shared code to be a same-PR change, not an inter-repo coordination problem.

## Decision

We use a single repo with **pnpm workspaces** for package linking and **Turborepo** for task orchestration and caching.

- `apps/` holds deployable surfaces (`web`, `desktop`, `e2e`).
- `packages/` holds shared libraries, each with a `@ai-workspace-lab/<name>` package name and `workspace:*` linking.
- A package's public surface is its `src/index.ts`. Cross-package imports go only through that.
- Turborepo runs `build`, `dev`, `typecheck`, `test`, `clean` across the graph with caching.

## Alternatives considered

- **Multi-repo + private registry** — strong isolation, but every shared change needs N PRs and version bumps. The coordination cost dominates the isolation benefit at our scale.
- **pnpm workspaces without Turborepo** — works for small graphs; lacks task caching and graph-aware orchestration. Pulled in for the moment we add CI parallelism.
- **Nx / Lerna** — heavier than we need. Turborepo is the lightest tool that gives us the caching we want.
- **Single Next.js app with no internal packages** — simplest, but the desktop companion can't reuse logic cleanly, and trust-bearing modules (entitlements, billing) deserve their own boundary.

## Consequences

- **What gets easier:** shared code changes land in one PR; types flow across packages with no publish step; CI builds the graph once and caches.
- **What gets harder:** package boundaries must be enforced by discipline (and the ESLint/Biome `no-internal-imports` style rules). Sloppy cross-package imports will rot the boundaries fast.
- **Trade-offs we accept:** every dev clones the whole repo, including the desktop app and e2e suite. Acceptable for the foreseeable future.

## Follow-up work

- [ ] Add a Biome rule (or import-pattern lint) that forbids reaching into a package's internals (`@ai-workspace-lab/foo/src/internal/...`).
- [ ] Document the package-public-surface convention in `CLAUDE.md` (currently implicit).
- [ ] Revisit if the repo crosses ~30 packages or a deploy unit needs a different node version than the rest.
