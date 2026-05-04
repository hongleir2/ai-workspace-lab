# AGENTS.md — hard-won lessons

## Feature work (non-trivial)

Invoke the global **feature-development-sop** skill: `~/.claude/skills/feature-development-sop/SKILL.md` (section *Repository overlay: ai-workspace-lab* for this monorepo). In short: plan → implement → `pnpm verify` (and `pnpm test:integration` when DB-related) → **code review** (see below) on the green diff → refresh [`docs/contexts/`](docs/contexts/README.md) for material sprint/data changes → commit → no push without explicit approval ([`CLAUDE.md`](CLAUDE.md) §11–12).

## No `.js` extensions in relative imports
Next.js webpack cannot remap `.js` → `.ts` for workspace package sources. Always write `./foo`, never `./foo.js`. `pnpm verify` passes either way; `next build` does not.

## `redirect()` goes outside `try/catch`
Next.js throws `NEXT_REDIRECT` internally. Call `redirect()` after the `try/catch` exits, never inside it.

## `db` singleton is a lazy Proxy
`packages/db/src/client.ts` initializes on first property access. Unit tests can import `db` without `DATABASE_URL`; integration tests still need it.

## `pnpm verify` ≠ CI build
`verify` runs lint + typecheck + unit tests. CI also runs `next build`. Check the build tab after pushing.

## Code review before every commit
After a feature or fix is **fully implemented**, run **`pnpm verify`** (and integration tests when the change touches DB/schema/persistence) so the diff is known-good before review. Then run a **code review pass on the complete diff** before the first `git commit` for that work. Do not commit until review findings are addressed or explicitly accepted (nits can be noted for follow-up). Same rule for follow-up commits on the same branch if they add non-trivial logic—re-review the delta.

- **Model:** use **Claude Sonnet 4.6** for the review chat/agent (select in Cursor before starting the review).
- **Scope:** trust boundaries, `CLAUDE.md` rules (org scope, no silent failures, migrations/tests where required), and whether the change matches the agreed plan.
- This repo cannot enforce the model or the review step in CI—treat it as a required human/agent gate before commit.
