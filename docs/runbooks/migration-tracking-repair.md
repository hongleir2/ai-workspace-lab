# Runbook: Drizzle Migration Tracking Repair

**When to use:** `db:migrate` fails with `type already exists`, `table already exists`, or
`relation already exists` — meaning the schema is ahead of what the tracking table records.

---

## How Drizzle's tracking table works

Drizzle stores applied migrations in `drizzle.__drizzle_migrations`:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | serial | Primary key (not used by the migration algorithm) |
| `hash` | text | SHA-256 of the `.sql` file content (stored for auditing, **not used for run/skip decisions**) |
| `created_at` | bigint | Millisecond timestamp — **this is what drives run/skip logic** |

The migration algorithm:
```
lastApplied = SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1
for each migration in _journal.json (ascending by `when`):
    if lastApplied is null OR lastApplied.created_at < migration.when:
        run the migration SQL
        insert a new tracking row
```

**Critical:** `created_at` values must match the `when` fields from `migrations/meta/_journal.json`.
Inserting small integers (1, 2, 3…) instead of real millisecond timestamps will make Drizzle
think nothing has been applied, because every journal `when` value (e.g. `1779038235543`) will be
greater than `3`.

---

## Step 1 — Identify which migrations are actually applied

Check what objects exist in the DB vs what the tracking table says:

```sql
-- What the tracking table thinks is applied
SELECT id, created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at;

-- Cross-check: confirm the jobs table exists (migration 0011)
SELECT to_regclass('public.jobs');

-- Or list all user tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

---

## Step 2 — Get the correct `when` values from the journal

```bash
node -e "
const j = JSON.parse(require('fs').readFileSync('packages/db/migrations/meta/_journal.json'));
j.entries.forEach(e => console.log(e.idx + '\t' + e.tag + '\t' + e.when));
"
```

---

## Step 3 — Compute file hashes (optional but good practice)

```bash
node -e "
const fs = require('fs'), crypto = require('crypto');
const dir = 'packages/db/migrations';
fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().forEach(f => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+f)).digest('hex');
  console.log(f + '  ' + h);
});
"
```

---

## Step 4 — Repair the tracking table

Run in the target database (local: `psql postgresql://postgres:postgres@localhost:54322/postgres`,
cloud: Supabase SQL Editor):

```sql
-- Replace N with the index of the last migration that IS applied in the DB.
-- Use the when values from Step 2.
DELETE FROM drizzle.__drizzle_migrations;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
  ('<hash_0000>', <when_0000>),
  ('<hash_0001>', <when_0001>),
  -- … one row per applied migration …
  ('<hash_000N>', <when_000N>);
```

For the current migration set (as of 2026-05-17), if 0000–0010 are applied:

```sql
DELETE FROM drizzle.__drizzle_migrations;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
  ('28a96b80e7349ca44ec27f02d34b2f382c308b82af7544ca349a0b4d4468a2e6', 1777820498318),
  ('8e38e04a2608342b65758df3d34fb866db235f4a6630c0bc4fe1cee405a36279', 1777920498318),
  ('c0374edec5e036e197803c0c7e1053f10fee45c65162133174f79e75122c7268', 1778020498318),
  ('65fd7f8f6d21580fcdf97f71bf96c90249262e45694f0c5429deaf1367b1fe55', 1778120498318),
  ('c8d75a04bc42728fd6c6625fbf6934a11d59091c7a36316ce8af497ecdef1360', 1778220498318),
  ('6d8e8e5643270da0366b6fed27bb0168d31190bde15f42572228cffebc707878', 1778320498318),
  ('0485c928a6d2379b52eec6a2c331d64d731fa81fd24f372145d4cf6bb683fd9b', 1778420498318),
  ('8ad0671cb4ca1bbe228ce08dd5ef8c32fddb70f291bc5c8bd6265bf298b847b9', 1778961079126),
  ('bba75fefc93fb72df0872826266dd5a7e0d1bd35483500f15a2dafd751f2ddce', 1779061079126),
  ('65b91a86099d98006f6024a0ee9b5daad06355f5bbd4d01da984ace08c15b988', 1779161079126),
  ('409f29c84e0c3193e3eed7ecd712703a08df8850f4a35cfe7a6f620283bce398', 1779261079126);
```

If all 16 migrations (0000–0015) are applied, add these rows too:

```sql
  ('c1134ea3fac2989cae6b69c07d93a4189a27ac1cde9ed23b527355f0b2b158da', 1779270000000),
  ('400ac360ed50a35ce022bc0c827bb3bd928caa53a31f82833cc5f21d62c77e7e', 1779280000000),
  ('7634461388307269a402a9041dc7e0d63901a5d86df81cf695dde1b5c1704d8f', 1779290000000),
  ('8fafeb7c6ee320789fa2d7b86dd9e1ecd9a2814eacd19ce3c43fcbea2caa9591', 1779320000000),
  ('a82d1796020833aeb99a356208dbdf67caf40cdecc7f865fec1724cbf459c593', 1779361079126);
```

---

## Step 5 — Re-run the migrate command

```bash
# Cloud
pnpm --filter @ai-workspace-lab/db db:migrate

# Local
pnpm --filter @ai-workspace-lab/db db:migrate:local
```

It should now only run the migrations that come after the last `created_at` in the tracking table.

---

## Orphaned types from partially-committed DDL

If a previous migration run created a type (e.g. `CREATE TYPE public.rate_limit_action`) but
rolled back the table creations, that type will remain. On the next run, the DO block that
wraps the `CREATE TYPE` will catch `duplicate_object`. PostgreSQL's subtransaction rollback
then puts the transaction in a state where subsequent DDL (e.g. `ALTER TABLE rate_limit_events`)
fails with `relation does not exist`, even though the table was created earlier in the same
transaction.

**Fix:** Drop orphaned types before retrying:

```sql
-- Check for orphaned enum types (those that exist without their associated tables)
SELECT typname FROM pg_type
WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'
ORDER BY typname;

-- Drop any type that should only exist after a migration that hasn't fully run
DROP TYPE IF EXISTS public.rate_limit_action;
```

Then re-run the migrate command.

---

## Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Inserted `created_at` as 1, 2, 3… | All migrations re-run, fail on existing objects | Re-insert with correct millisecond `when` values from journal |
| Ran the repair SQL twice | Duplicate rows; Drizzle still re-runs from 0000 | `DELETE FROM drizzle.__drizzle_migrations` then single INSERT |
| Used `DATABASE_URL` (pooler, port 6543) | `Error: prepared statement does not exist` or silent connection reset | Switch to `DATABASE_DIRECT_URL` (port 5432) |
| Edited a shipped migration file | Hash in file differs from hash recorded in tracking table (informational only — won't break runs, but hash audit is misleading) | Never edit shipped migrations; add a new one instead |
