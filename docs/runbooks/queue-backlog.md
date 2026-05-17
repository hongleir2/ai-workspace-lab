# Runbook: Job Queue Backlog

**When to use:** The job queue has accumulated a large backlog (many `pending` or `retrying` rows), documents are stuck in `processing` state, or the `/admin/jobs` page shows a spike in dead-lettered jobs.

---

## 0. Local development setup

**Required env vars** (add to `.env.local`):
```
WORKER_SECRET=any-secret-string        # bearer token for /api/internal/run-worker
ADMIN_EMAILS=you@example.com           # comma-separated; grants access to /admin/jobs
```

**Start the stack:**
```bash
pnpx supabase start
pnpm --filter @ai-workspace-lab/db db:migrate
pnpm dev
```

**Test the end-to-end flow:**
1. Upload a document at `/app/[orgSlug]/documents/new` — document status shows **Queued**
2. Trigger the worker:
   ```bash
   curl -X POST http://localhost:3000/api/internal/run-worker \
     -H "Authorization: Bearer your-secret-string"
   ```
3. Refresh the document detail page — status progresses to **Processing → Ready**
4. Visit `/admin/jobs` (email must be in `ADMIN_EMAILS`) to see failed/dead-lettered jobs

---

## 1. Assess the situation

```sql
-- Count jobs by status
SELECT status, COUNT(*) FROM jobs GROUP BY status ORDER BY COUNT(*) DESC;

-- Find jobs stuck in 'processing' longer than 10 minutes (locked by worker that may have died)
SELECT id, job_type, locked_by, locked_at, attempts_count
FROM jobs
WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '10 minutes';

-- Recent dead-lettered jobs with errors
SELECT id, job_type, last_error_code, last_error_message, dead_lettered_at
FROM jobs
WHERE status = 'dead_lettered'
ORDER BY dead_lettered_at DESC
LIMIT 20;
```

---

## 2. Common failure modes

### 2a. Worker not running / cron stopped
**Symptom:** Jobs piling up in `pending` status, no `processing` rows at all, no recent `completed` rows.

**Fix:** Trigger the worker manually or check the scheduler (Vercel Cron / QStash):
```bash
curl -X POST https://your-app.vercel.app/api/internal/run-worker \
  -H "Authorization: Bearer $WORKER_SECRET"
```
Repeat until the backlog clears, or increase cron frequency.

---

### 2b. Jobs stuck in `processing` (crashed worker)
**Symptom:** Rows with `status = 'processing'` and `locked_at` more than 10 minutes ago.

**Cause:** The worker process crashed or timed out without updating the job status.

**Fix:** Reset stuck jobs back to `pending`:
```sql
-- Preview first
SELECT id, locked_by, locked_at FROM jobs
WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '10 minutes';

-- Reset (run in a transaction)
BEGIN;
UPDATE jobs
SET status = 'retrying',
    locked_by = NULL,
    locked_at = NULL,
    run_after = NOW(),
    updated_at = NOW()
WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '10 minutes';
-- Verify row count matches preview, then:
COMMIT;
```

> **Note:** A worker health-check cron to auto-reset stuck jobs is not yet implemented. This is a manual step.

---

### 2c. Dead-lettered jobs — transient error
**Symptom:** Jobs with `status = 'dead_lettered'` due to a transient error (storage outage, DB blip) that has since recovered.

**Fix:** Re-queue the dead-lettered jobs:
```sql
-- Preview
SELECT id, job_type, last_error_code, payload FROM jobs
WHERE status = 'dead_lettered'
ORDER BY dead_lettered_at DESC
LIMIT 50;

-- Re-queue (resets attempts counter so they get max_attempts more tries)
BEGIN;
UPDATE jobs
SET status = 'pending',
    attempts_count = 0,
    dead_lettered_at = NULL,
    last_error_code = NULL,
    last_error_message = NULL,
    run_after = NOW(),
    updated_at = NOW()
WHERE status = 'dead_lettered'
AND last_error_code IN ('EXTRACTION_FAILED', 'UNKNOWN_ERROR')
-- Scope to specific IDs if only re-queueing some:
-- AND id IN ('id-1', 'id-2');
;
COMMIT;
```

---

### 2d. Dead-lettered jobs — permanent error (unsupported file type)
**Symptom:** `last_error_code = 'EXTRACTION_FAILED'` with message `"Unsupported file type: docx"`.

**Fix:** Do not re-queue. Mark the associated document with a user-visible error and notify the user (future sprint). For now, ensure the document row reflects the failure:
```sql
-- Check document status
SELECT d.id, d.status, d.processing_error_code, d.file_type
FROM documents d
JOIN jobs j ON j.payload->>'documentId' = d.id
WHERE j.status = 'dead_lettered'
AND j.last_error_message ILIKE '%Unsupported file type%';

-- If document is not already 'failed', update it
UPDATE documents SET
  status = 'failed',
  processing_error_code = 'UNSUPPORTED_FILE_TYPE',
  processing_error_message = 'File type is not supported for text extraction',
  updated_at = NOW()
WHERE id = 'document-id-here'
AND status != 'failed';
```

---

## 3. Escalation

| Signal | Action |
|--------|--------|
| >100 dead-lettered jobs in 1 hour | Page on-call: likely storage or DB outage affecting all jobs |
| Jobs stuck in `processing` system-wide | Check Vercel function logs for OOM/timeout; consider reducing `maxDuration` work |
| `EXTRACTION_FAILED` with PDF parse errors | Check `pdf-parse` version; may need to update or swap parser |
| Backlog grows faster than worker processes | Scale worker invocation frequency or parallelize cron calls |

---

## 4. Monitoring queries (add to dashboards)

```sql
-- Pending backlog depth (alert if > 50)
SELECT COUNT(*) FROM jobs WHERE status = 'pending' AND run_after <= NOW();

-- Dead-letter rate per hour
SELECT DATE_TRUNC('hour', dead_lettered_at) AS hour, COUNT(*)
FROM jobs WHERE dead_lettered_at > NOW() - INTERVAL '24 hours'
GROUP BY 1 ORDER BY 1 DESC;

-- Average processing time (minutes)
SELECT AVG(EXTRACT(EPOCH FROM (completed_at - locked_at)) / 60) AS avg_minutes
FROM jobs WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour';
```
