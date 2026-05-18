# Logging Runbook

## Overview

All server-side packages emit structured JSON logs to Axiom via `@axiomhq/logging`. The web app's middleware adds a `traceId` (12-char nanoid) to every request so logs from different packages can be correlated.

**Log levels by environment:**

| Environment | debug | info | warn | error |
|---|---|---|---|---|
| Local dev (`NODE_ENV=development`) | ✓ | ✓ | ✓ | ✓ |
| Vercel Preview (`VERCEL_ENV=preview`) | ✓ | ✓ | ✓ | ✓ |
| Vercel Production (`VERCEL_ENV=production`) | — | ✓ | ✓ | ✓ |

---

## How logs are organized

Every log line has a `module` field set at logger creation time:

| Module | Source |
|---|---|
| `middleware` | `apps/web/src/middleware.ts` — one entry per HTTP request |
| `billing/webhook-handler` | Stripe webhook dispatch |
| `billing/service` | Stripe customer / checkout / portal creation |
| `entitlements/service` | Quota and feature-flag checks |
| `usage/service` | Usage recording and deduplication |
| `storage/service` | File upload target creation |
| `jobs/worker` | Job lifecycle (claimed, completed, retried, dead-lettered) |
| `jobs/process-document` | Document text extraction pipeline |
| `api/documents` | POST /api/orgs/[orgSlug]/documents |
| `api/stripe-webhook` | POST /api/webhooks/stripe |
| `api/run-worker` | POST /api/internal/run-worker |

### Correlation fields

- **`traceId`** — injected by middleware into `x-trace-id` header; included in all API route logs. Correlates HTTP request logs with business logs for the same request.
- **`orgId`** — present on all org-scoped events; use to narrow all logs to one tenant.
- **`documentId`** — use to trace a single document through upload → processing → ready/failed.
- **`jobId`** — use to trace a single job attempt through worker → handler.

---

## Searching logs in Axiom

Axiom uses APL (Axiom Processing Language). Open your dataset → **Explorer** tab.

### Trace a full document upload end-to-end

```apl
['ai-workspace-lab']
| where traceId == 'abc123xyz'
| sort by _time asc
```

### All events for one organization

```apl
['ai-workspace-lab']
| where orgId == 'org-uuid-here'
| sort by _time asc
```

### All errors in the last hour

```apl
['ai-workspace-lab']
| where level == 'error'
| where _time > ago(1h)
| sort by _time desc
```

### Quota exceeded events (who is hitting limits?)

```apl
['ai-workspace-lab']
| where ['message'] == 'quota.exceeded'
| summarize count() by orgId
| sort by count_ desc
```

### Document processing failures

```apl
['ai-workspace-lab']
| where ['message'] == 'document.processing.failed'
| project _time, documentId, orgId, error
| sort by _time desc
```

### Jobs that were dead-lettered

```apl
['ai-workspace-lab']
| where ['message'] == 'job.dead_lettered'
| project _time, jobId, jobType, orgId, errorCode, errorMessage
| sort by _time desc
```

### Trace one document through the full pipeline

```apl
['ai-workspace-lab']
| where documentId == 'doc-uuid-here'
| sort by _time asc
```

This shows: `document.upload.requested` → `document.upload.created` → `job.claimed` → `document.processing.started` → `document.text_extracted` → `document.processing.completed` (or `document.processing.failed`).

---

## Common tracing workflows

### "A user says upload is broken"

1. Ask for their `orgId` (from Supabase → organizations table) or email.
2. Search: `orgId == 'their-org-id' | where _time > ago(24h) | sort by _time desc`
3. Look for `document.upload.failed`, `document.upload.quota_exceeded`, `document.upload.feature_disabled`, or `file.invalid_type` / `file.too_large`.
4. If you see `document.upload.created` but no `document.processing.started`, the job was never enqueued — check QStash dashboard.
5. If you see `document.processing.failed`, look at the `error` field for the root cause.

### "Document is stuck in 'processing' status"

1. Get the `documentId` from the DB.
2. Search: `documentId == 'doc-id'`
3. Look for `job.claimed` → if missing, the job was never picked up (check worker cron).
4. Look for `document.download.start` but no `document.download.done` → R2 connection issue.
5. Look for `document.extract.start` but no `document.extract.done` → PDF parse timeout.
6. If `document.processing.failed`, check `errorCode` and `error` fields.
7. Look for `zombie.reaped` with this `jobId` — if present, the job timed out (Vercel 60s limit).

### "Stripe webhook seems to not be processing"

1. Search: `module == 'api/stripe-webhook' | where _time > ago(1h)`
2. Check for `stripe.webhook.signature_invalid` — means the signing secret is wrong.
3. Check for `stripe.webhook.failed` — look at the `error` field.
4. Check for `stripe.webhook.received` without `stripe.webhook.processed` — the handler threw.
5. Cross-reference with `module == 'billing/webhook-handler'` for `webhook.deduplicated` — repeated deliveries are fine.

### "Is our quota enforcement working?"

```apl
['ai-workspace-lab']
| where ['message'] in ('quota.exceeded', 'feature.not_included', 'subscription.not_found')
| summarize count() by ['message'], orgId
| sort by count_ desc
```

---

## Adding logs to new code

### In a server-side package (`packages/*`)

```typescript
import { createLogger } from '@ai-workspace-lab/logger';

const logger = createLogger('my-package/my-module');

// Business event (always emitted)
logger.info('thing.happened', { orgId, thingId });

// Warning (always emitted)
logger.warn('thing.suspicious', { orgId, reason });

// Error (always emitted)
logger.error('thing.failed', { orgId, error: err.message });

// Debug trace (dev + preview only, suppressed in production)
logger.debug('thing.detail', { orgId, rawData });
```

### In a Next.js API route (`apps/web`)

```typescript
import { logger } from '@/lib/axiom/server';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  const traceId = (await headers()).get('x-trace-id') ?? undefined;

  logger.info('my-route.started', { traceId, orgId });
  // ...
  logger.info('my-route.completed', { traceId, orgId, result });
}
```

### Log level guidelines

| Level | When to use |
|---|---|
| `debug` | Fine-grained steps useful only when debugging (e.g. "fetched N rows", "buffer size X bytes"). Never in hot paths at high volume. |
| `info` | Normal business events that always matter (job claimed, document ready, checkout created). |
| `warn` | Expected-but-notable events (quota exceeded, deduplication, unauthorized attempt). |
| `error` | Failures that require attention (processing failed, dead-lettered job, webhook processing error). |
