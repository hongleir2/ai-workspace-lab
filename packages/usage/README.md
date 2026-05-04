# @ai-workspace-lab/usage

Server-side **usage recording**: immutable `usage_events` and fast aggregates in `usage_counters`. Call only from trusted server code (same DB role as other services; RLS on these tables is not a write path for the anon key).

## API

| Export | Purpose |
|--------|---------|
| `recordUsageEvent` | Insert one event; `ON CONFLICT DO NOTHING` on `idempotency_key` (non-null keys dedupe) |
| `incrementUsageCounter` | Upsert counter row; on conflict, add `delta` to `used_quantity` atomically |
| `getUsageForFeature` | Read one `usage_counters` row for org + feature + period |
| `getUsageSummaryForOrganization` | All counters for an org (ordered by feature, period) |
| `recordUsageWithCounter` | Transaction: record event, then increment counter **only if** the insert succeeded |

## Composing with your own transaction

`recordUsageWithCounter` opens its own transaction internally. **Do not pass a transaction client as the `dbConn` argument** — postgres.js wraps nested `.transaction()` calls in savepoints, so an outer rollback may not roll back the inner work reliably.

If you need to compose usage recording inside a larger transaction (e.g. alongside an AI message insert), call the primitives directly:

```ts
await db.transaction(async (tx) => {
  // your other writes …
  const result = await recordUsageEvent(eventInput, tx);
  if (result.inserted) {
    await incrementUsageCounter({ ...counterArgs }, tx);
  }
});
```

## Contract with entitlements

`@ai-workspace-lab/entitlements` reads `usage_counters` for quota. **`period_start` / `period_end` passed to this package must match** the period returned by `getCurrentBillingPeriod` for that org’s subscription and limit’s `reset_interval`, or quota checks will still see zero usage.

## Tests / verify

```bash
pnpm verify
pnpm test:integration   # from repo root; needs local Postgres + migrations
```

Integration test: `src/service.integration.test.ts`.

## References

- [ERD — usage tables](../../docs/product/erd.md)
- [Implementation principles — usage idempotency](../../docs/product/implementation-principles.md)
