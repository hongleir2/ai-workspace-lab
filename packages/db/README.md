# @ai-workspace-lab/db

Database access layer for the ai-workspace-lab monorepo.

## Status

Implemented — see [ADR 0004](../../docs/adr/0004-database-access-layer.md) (Accepted).

## Stack

| Tool | Role |
|---|---|
| [Drizzle ORM](https://orm.drizzle.team) | Schema-as-code, query builder, type-safe client |
| [postgres.js](https://github.com/porsager/postgres) | Postgres driver (Drizzle's recommended driver) |
| [drizzle-kit](https://orm.drizzle.team/kit-docs/overview) | Migration generator, push, studio |
| Supabase Postgres | Database backing (Postgres + RLS + pgvector) |

Supabase Auth, Storage, and Realtime are handled by `@supabase/supabase-js` in the consuming app
(`apps/web`). This package owns the relational layer; Supabase owns identity, files, and pub/sub.

## Layout

```
packages/db/
├── src/
│   ├── client.ts        # postgres.js + drizzle() singleton; export: db, Database
│   ├── migrate.ts       # migration runner (drizzle-orm/postgres-js/migrator)
│   ├── schema/
│   │   └── index.ts     # re-exports all domain schema files (empty — no product tables yet)
│   └── index.ts         # public package exports
├── migrations/          # drizzle-kit output — plain .sql files; commit alongside schema changes
├── seed/
│   └── index.ts         # seed runner — refuses in production
├── drizzle.config.ts    # drizzle-kit config (schema path, migrations dir, dialect)
├── package.json
└── README.md
```

## Commands

Run from repo root with `pnpm --filter @ai-workspace-lab/db <script>`, or from `packages/db/`
with `pnpm <script>`:

| Script | Description |
|---|---|
| `pnpm db:generate` | Generate a new `.sql` migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations to the target database |
| `pnpm db:push` | Push schema directly to database (dev only — no migration file) |
| `pnpm db:studio` | Open Drizzle Studio for visual inspection |
| `pnpm db:seed` | Run seed script (blocked in `NODE_ENV=production`) |

All scripts require `DATABASE_URL` in the environment. Use a `.env` file at `packages/db/.env`
for local runs (loaded via `dotenv/config`), or set it in your shell.

## Schema conventions

Every product table must follow these conventions exactly. Deviating requires a comment explaining
why.

### Identifiers

```sql
id uuid primary key default gen_random_uuid()
```

Table names: plural, `snake_case` (e.g., `organizations`, `documents`, `membership_invites`).
Column names: `snake_case`. Foreign keys use the short form: `org_id`, `user_id`, `doc_id`.

### Timestamps

Every table has:

```sql
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

`updated_at` is maintained by a shared trigger function:

```sql
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on <table>
  for each row execute function set_updated_at();
```

Add the trigger in the migration for every table that has `updated_at`.

### Multi-tenancy

Every product table includes:

```sql
org_id uuid not null references organizations(id) on delete cascade
```

This enforces tenant scoping at the database level. Never omit `org_id` from a product table
without a documented reason in the schema file.

### Row-Level Security (RLS)

Every product table must have RLS enabled:

```sql
alter table <table> enable row level security;
```

Policies select via membership lookup against `auth.uid()` from the current request JWT. Example
pattern:

```sql
create policy "org members can read"
  on <table> for select
  using (
    org_id in (
      select org_id from memberships where user_id = auth.uid()
    )
  );
```

RLS policies live in the migration SQL alongside the `create table` statement. drizzle-kit does
not generate RLS policies — add them manually after the generated SQL block.

### Profile updates — safe-field allowlist

Even with RLS, application code must restrict which columns a user can update on their own row. RLS controls *which rows* are reachable, not *which columns* are mutable.

Identity, lifecycle, and audit columns must NEVER be updated through user-facing endpoints:

- `auth_provider`, `auth_provider_user_id` — identity binding, owned by the auth flow
- `email` — identity, changes go through a verification flow
- `status` — lifecycle, owned by admin/server actions
- `deleted_at` — soft-delete state, owned by the deletion server action
- `created_at`, `updated_at` — audit, managed by the database

User-facing profile updates may only mutate: `display_name`, `avatar_url`, `timezone`.

Enforce this allowlist in the server action (or RPC) that fronts profile updates. Do not pass arbitrary `Partial<User>` objects to `db.update()` from a request handler.

### Auth foreign system

Supabase owns `auth.users`. This package only references it via foreign key:

```sql
references auth.users(id)
```

Never write to `auth.users` from Drizzle. Never define a Drizzle table for `auth.users`.

### Soft delete

Soft delete is **opt-in only** — add `deleted_at timestamptz` only when business requirements
demand it. The default is hard delete. Document the reason in the schema file when opting in.

### pgvector

Vector columns declare dimension as a comment:

```typescript
// 1536 dimensions — OpenAI text-embedding-3-small
embedding: vector(1536),

// 768 dimensions — nomic-embed-text
embedding: vector(768),
```

Use HNSW indexes for approximate nearest-neighbour (ANN) search:

```sql
create index on documents using hnsw (embedding vector_cosine_ops);
```

Fixed dimension per use case. Do not mix embedding models in the same column.

## Migration flow

1. Edit or add schema in `src/schema/<domain>.ts`.
2. Run `pnpm db:generate` to produce a `.sql` file in `migrations/`.
3. Review the generated SQL. Edit only to add:
   - RLS `enable row level security` + policies
   - Trigger setup for `updated_at`
   - HNSW or GIN indexes that drizzle-kit cannot infer
4. Commit the schema file and migration file together in a single commit.
5. Run `pnpm db:migrate` against the target database:
   - Local: `supabase start`, then set `DATABASE_URL` to the local pooler URL.
   - Production: swap `DATABASE_URL` to the production pooler URL, run once, swap back.
6. **Forward-only**: never edit a migration that has been merged. Fix forward with a new migration.

## Known TODOs

- **JWT-context propagation for RLS from RSC**: queries from React Server Components need a
  per-request `set_config('request.jwt.claims', ...)` call so `auth.uid()` resolves correctly
  inside RLS policies. The likely pattern is a `withAuth(db, jwt)` wrapper. This is out of scope
  until the first product table lands. Tracked in ADR 0004 follow-up.
