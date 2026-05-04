# AGENTS.md — hard-won lessons

## No `.js` extensions in relative imports
Next.js webpack cannot remap `.js` → `.ts` for workspace package sources. Always write `./foo`, never `./foo.js`. `pnpm verify` passes either way; `next build` does not.

## `redirect()` goes outside `try/catch`
Next.js throws `NEXT_REDIRECT` internally. Call `redirect()` after the `try/catch` exits, never inside it.

## `db` singleton is a lazy Proxy
`packages/db/src/client.ts` initializes on first property access. Unit tests can import `db` without `DATABASE_URL`; integration tests still need it.

## `pnpm verify` ≠ CI build
`verify` runs lint + typecheck + unit tests. CI also runs `next build`. Check the build tab after pushing.
