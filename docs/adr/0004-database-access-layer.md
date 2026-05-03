# 0004 — Database access layer (ORM + migrations)

## Status

Accepted — 2026-05-02

## Context

[ADR 0001](./0001-stack-choice.md) locked in **Supabase Postgres** as the database, but stayed silent on *how* the application talks to it. With `packages/db/` about to land its first real implementation, that gap has to close before any product table is written. Decisions made now will shape how every later feature reads, writes, migrates, and tests against the database.

The constraints that actually matter for this project:

- **Multi-tenant SaaS** — every product table will need `org_id` scoping enforced via Postgres RLS policies (decided in ADR 0001).
- `**pgvector` for RAG** — the access layer must let us define vector columns and run `<->` similarity queries without falling back to raw SQL for everything.
- **Next.js 15 + RSC + edge** — server components and edge handlers both need to query. The data layer can't drag a heavy runtime engine into either.
- **Modular monolith** — `packages/db` is consumed by `apps/web`, `packages/jobs`, future `packages/api`. The choice has to scale across consumers without per-consumer config.
- **One person, shipping product** — schema-as-code in TypeScript beats a separate DSL; migration flow has to be obvious six months from now.

## Decision

We use **Drizzle ORM** with `drizzle-kit` for migrations, plus `@supabase/supabase-js` for Auth, Storage, and Realtime.

- **Schema**: TypeScript files under `packages/db/src/schema/`, one file per domain. Drizzle's `pgTable` definitions are the source of truth.
- **Migrations**: `drizzle-kit generate` produces plain `.sql` files in `packages/db/migrations/`. Files are committed and **never edited** after merge — reversibility is a forward migration, not a rollback.
- **Connection**: `postgres.js` driver (Drizzle's recommended Postgres client), pooled via Supabase's connection pooler URL. One singleton `db` exported from `packages/db/src/client.ts`.
- **Auth/Storage/Realtime**: handled by `@supabase/supabase-js`. Drizzle owns tables and queries; Supabase owns identity, files, and pub/sub. They share the same database but address it through different APIs.
- **Seeding**: `packages/db/seed/index.ts` script run via `pnpm db:seed`. Refuses to run unless `NODE_ENV !== 'production'`.

This ADR documents the *access layer* decision. **Schema conventions** (naming, IDs, timestamps, RLS pattern, pgvector dimensions) live in `[packages/db/README.md](../../packages/db/README.md)` — they're documentation of the implementation, not architectural choices that need ADR governance.

## Alternatives considered

- **Prisma** — The most ergonomic ORM, biggest ecosystem. Rejected for three reasons specific to this stack: (1) the Rust query engine adds runtime weight that's painful in Next.js edge handlers and serverless cold starts; (2) Supabase RLS depends on `auth.uid()` from the request's JWT, and Prisma's connection model makes propagating that auth context awkward — you end up bypassing the ORM for any RLS-aware query; (3) `pgvector` is a raw-SQL escape hatch in Prisma, not a first-class type. Drizzle wins all three.
- **Kysely** — Pure SQL query builder, no schema-as-code layer. Closest competitor to Drizzle on weight and edge compatibility. Rejected because we'd still need to bring our own migrator (`kysely-migrator` exists but is bare-bones), and we'd lose the type-safe schema introspection that makes IDE autocomplete work across the monorepo. Drizzle gives us both query builder *and* schema-as-code in one tool with no extra dependencies.
- **Raw `@supabase/supabase-js` (PostgREST)** — Supabase's own client. Excellent for simple CRUD and RLS-aware reads, but loses type fidelity on joins, window functions, CTEs, and anything pgvector-related. Would force us to context-switch between PostgREST and raw SQL constantly. Better to use it for what it's good at (Auth, Storage, Realtime) and let Drizzle handle the relational layer.
- **Supabase CLI migrations only, no ORM** — Use the Supabase CLI's migration system and write all queries as raw SQL via `supabase-js.rpc()`. Rejected because losing TypeScript types on every query is a high tax for a one-person codebase where I'm both author and reviewer. Drizzle's generated types are the cheapest form of code review I can buy.

## Consequences

- **What gets easier:**
  - Schema changes are TypeScript edits — no DSL to learn, no codegen step to run before queries typecheck.
  - `drizzle-kit` migrations are plain SQL we can read, review, and apply through the Supabase CLI / SQL editor in production if needed.
  - RLS policies stay in SQL migrations alongside table definitions — Drizzle doesn't fight them, doesn't try to manage them, just respects them.
  - `pgvector` columns are declared as `vector(1536)` in the schema and queried with Drizzle's SQL helpers; no raw escape hatch needed for the common case.
  - Edge runtime works without special config — `postgres.js` runs on Cloudflare Workers, Vercel Edge, and Node.
- **What gets harder:**
  - Drizzle's ecosystem is younger than Prisma's. Fewer tutorials, fewer Stack Overflow answers, fewer plug-and-play admin tools (though `drizzle-kit studio` covers basic introspection).
  - No built-in dataloader / N+1 protection. We'll have to be deliberate about batching in resolvers if/when GraphQL or tRPC layers land. Mitigation: use `inArray()` joins explicitly; if N+1 patterns emerge, add `dataloader` per-request in the consumer package.
  - Schema migrations are forward-only by convention. If we ship a bad migration to production, we recover by writing a *new* migration that fixes it — not by reverting. This is industry standard but worth being explicit: nobody runs `down()`.
- **Trade-offs we accept:**
  - We accept a smaller community in exchange for a tool that's a better fit for Supabase + RSC + edge. The cost shows up as occasional GitHub issue spelunking; the benefit shows up every day in cold-start time and edge compatibility.
  - We accept maintaining schema in two places conceptually — Drizzle owns tables, Supabase owns Auth's `auth.users` table. We treat `auth.users` as a foreign system: read its `id` via foreign key references, never write to it from Drizzle.
  - We accept that connection pooling is Supabase's pooler problem, not ours. If we hit pool saturation we'll revisit (PgBouncer transaction mode vs. session mode is the usual fork). Until then, default config.

## Follow-up work

- Implement the package per this ADR — `packages/db/{client.ts, schema/, migrations/, seed/}` + `drizzle.config.ts` + scripts. Tracked on `feature/db-tooling`.
- Document schema conventions (naming, IDs, timestamps, RLS pattern, pgvector dimensions) in `packages/db/README.md`. Conventions are implementation choices, not architectural; they live in the package, not in an ADR.
- First product migration (organizations + memberships) — separate PR, will be the smoke test for the conventions and the RLS pattern.
- Decide on the JWT-context propagation pattern for RLS-aware queries from RSC. Likely a `withAuth(db, jwt)` wrapper that calls `set_config('request.jwt.claims', ...)` per connection. Out of scope for this ADR — flag it in `packages/db/README.md` as a known TODO when the first RLS table lands.

## Switch trigger (when to revisit)

- Drizzle ecosystem stagnates or diverges from Postgres feature parity (we'd revisit, probably to Kysely or Prisma).
- We hit `pgvector` query patterns that genuinely need a vector-DB-shaped client (Pinecone migration trigger from ADR 0001 fires first).
- Team grows past one person and someone arrives with strong Prisma muscle memory — revisit cost is real, weigh it then.

