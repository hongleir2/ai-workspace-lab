# 0011 — Background Job Architecture

## Status
Accepted

## Context

Document processing (text extraction, chunking, future embedding) can take several seconds to minutes depending on file size and type. Running this synchronously inside an API route handler blocks the HTTP response, inflates cold-start times, and cannot be safely retried on transient failures.

The project already includes Upstash Redis + QStash in the stack (ADR 0001) for queuing and rate-limiting. However, during early development (Sprint 10) the team chose to build a lightweight Postgres-native job queue first, deferring QStash until the processing volume justifies a managed queue. The reasons:

1. **Zero extra dependencies in CI.** Postgres is already required for migrations and integration tests. Adding QStash to CI requires HTTP calls to an external service or a mock layer.
2. **Full observability from day one.** Job rows, attempt rows, error codes, and retry counts are queryable SQL — no additional tooling needed.
3. **Atomic enqueue.** A job can be inserted in the same DB transaction as the document row, preventing the "document created but never processed" failure mode.
4. **Simple operational model.** A single cron or Vercel scheduled function calling `POST /api/internal/run-worker` is sufficient for current throughput.

## Decision

Implement a Postgres-native job queue in `packages/jobs` with the following design:

### Schema

Two tables (migration 0011):
- **`jobs`** — one row per logical task. Columns: `id`, `organization_id`, `job_type`, `status` (pending → processing → completed | retrying | dead_lettered | failed), `payload` (JSONB), `idempotency_key` (UNIQUE), `attempts_count`, `max_attempts` (default 3), `run_after`, `locked_by`, `locked_at`, `completed_at`, `failed_at`, `dead_lettered_at`, `last_error_code`, `last_error_message`.
- **`job_attempts`** — one row per execution attempt. Columns: `id`, `job_id` (FK), `attempt_number`, `status` (started → succeeded | failed), `started_at`, `ended_at`, `error_code`, `error_message`.

### Claim logic (`runWorkerOnce`)

```sql
UPDATE jobs SET status='processing', locked_by=$workerId, locked_at=$now, updated_at=$now
WHERE id = (
  SELECT id FROM jobs
  WHERE status IN ('pending', 'retrying') AND run_after <= $now
  ORDER BY run_after ASC LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING id, job_type, payload, attempts_count, max_attempts
```

`FOR UPDATE SKIP LOCKED` ensures multiple concurrent workers never claim the same job. Workers are stateless — each `POST /api/internal/run-worker` call processes one job.

### Retry and backoff

Exponential backoff: `min(60 × 5^(attemptNumber−1), 86400)` seconds (caps at 24 hours).

| Attempt | Backoff |
|---------|---------|
| 1       | 60 s    |
| 2       | 300 s   |
| 3       | 1500 s  |

After `max_attempts` (default 3), the job is dead-lettered. The document row is marked `failed` with `processing_error_code = 'EXTRACTION_FAILED'`.

### Idempotency

- Job creation uses `ON CONFLICT (idempotency_key) DO NOTHING`. Calling `createProcessDocumentJob(documentId, orgId)` twice creates exactly one job.
- The handler deletes existing `document_chunks` before inserting new ones, making retries safe.

### Worker trigger

`POST /api/internal/run-worker` (Next.js App Router route, `maxDuration = 60`). Protected by a `WORKER_SECRET` bearer token when set. Suitable for invocation by Vercel Cron, QStash, or any HTTP scheduler.

## Consequences

**Accepted:**
- Polling latency: a document waits until the next worker invocation (cron interval). Acceptable for current use case (document indexing, not real-time).
- No fan-out parallelism from a single invocation. The scheduler must call the endpoint concurrently to process multiple jobs in parallel.
- Job rows accumulate in `jobs` table. A periodic cleanup job (not yet implemented) is needed to purge old `completed` rows.

**Deferred to future ADR:**
- Migrate to QStash when throughput requires managed delivery guarantees or push-based fan-out.
- Add a `max_file_size_mb` entitlement check inside the job handler (currently checked at upload time only).
- Embed vectors in `document_chunks` once an embedding provider is chosen (Sprint 11+).
