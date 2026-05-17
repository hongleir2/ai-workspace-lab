import { randomUUID } from 'node:crypto';
import { type Database, db, eq, jobAttempts, jobs, sql } from '@ai-workspace-lab/db';

export interface CreateJobParams {
  jobType: string;
  organizationId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export interface ClaimedJob {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  attemptsCount: number;
  maxAttempts: number;
}

const MAX_BACKOFF_SECONDS = 24 * 60 * 60;

/**
 * Enqueues a job. Safe to call multiple times — duplicate idempotencyKey is silently ignored.
 * If no idempotencyKey is provided, a random UUID is used (no dedup).
 */
export async function createJob(params: CreateJobParams, dbConn: Database = db): Promise<void> {
  const idempotencyKey = params.idempotencyKey ?? `${params.jobType}:${randomUUID()}`;
  await dbConn
    .insert(jobs)
    .values({
      jobType: params.jobType,
      organizationId: params.organizationId,
      status: 'pending',
      payload: params.payload,
      idempotencyKey,
      maxAttempts: params.maxAttempts ?? 3,
    })
    .onConflictDoNothing({ target: jobs.idempotencyKey });
}

/**
 * Atomically claims one pending/retrying job using FOR UPDATE SKIP LOCKED.
 * Returns null if no job is available.
 */
export async function claimNextJob(
  workerId: string,
  dbConn: Database = db,
): Promise<ClaimedJob | null> {
  const now = new Date();
  const rows = await dbConn.execute(sql`
    UPDATE jobs SET
      status = 'processing',
      locked_by = ${workerId},
      locked_at = ${now.toISOString()},
      updated_at = ${now.toISOString()}
    WHERE id = (
      SELECT id FROM jobs
      WHERE status IN ('pending', 'retrying')
        AND run_after <= ${now.toISOString()}
      ORDER BY run_after ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, job_type, payload, attempts_count, max_attempts
  `);

  const row = rows[0] as
    | {
        id: string;
        job_type: string;
        payload: Record<string, unknown>;
        attempts_count: number;
        max_attempts: number;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    jobType: row.job_type,
    payload: row.payload,
    attemptsCount: row.attempts_count as number,
    maxAttempts: row.max_attempts as number,
  };
}

/**
 * Records a new job_attempt row for the given job and attempt number.
 */
export async function startJobAttempt(
  jobId: string,
  attemptNumber: number,
  dbConn: Database = db,
): Promise<{ id: string } | undefined> {
  const [attempt] = await dbConn
    .insert(jobAttempts)
    .values({ jobId, attemptNumber, status: 'started' })
    .returning();
  return attempt;
}

/**
 * Marks a job and its attempt as successfully completed.
 */
export async function completeJob(
  jobId: string,
  attemptId: string | undefined,
  attemptNumber: number,
  dbConn: Database = db,
): Promise<void> {
  const completedAt = new Date();
  await dbConn
    .update(jobs)
    .set({
      status: 'completed',
      attemptsCount: attemptNumber,
      lockedBy: null,
      lockedAt: null,
      completedAt,
    })
    .where(eq(jobs.id, jobId));

  if (attemptId) {
    await dbConn
      .update(jobAttempts)
      .set({ status: 'succeeded', endedAt: completedAt })
      .where(eq(jobAttempts.id, attemptId));
  }
}

/**
 * Marks a job as permanently failed (terminal state, no retry).
 */
export async function failJob(
  jobId: string,
  params: { attemptNumber: number; errorCode: string; errorMessage: string; attemptId?: string },
  dbConn: Database = db,
): Promise<void> {
  const endedAt = new Date();

  if (params.attemptId) {
    await dbConn
      .update(jobAttempts)
      .set({
        status: 'failed',
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        endedAt,
      })
      .where(eq(jobAttempts.id, params.attemptId));
  }

  await dbConn
    .update(jobs)
    .set({
      status: 'failed',
      attemptsCount: params.attemptNumber,
      lockedBy: null,
      lockedAt: null,
      lastErrorCode: params.errorCode,
      lastErrorMessage: params.errorMessage,
      failedAt: endedAt,
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Marks a job for retry with exponential backoff.
 * Backoff: min(60 × 5^(attemptNumber−1), 86400) seconds.
 */
export async function retryJobWithBackoff(
  jobId: string,
  params: { attemptNumber: number; errorCode: string; errorMessage: string; attemptId?: string },
  dbConn: Database = db,
): Promise<void> {
  const endedAt = new Date();
  const backoffSeconds = Math.min(60 * 5 ** (params.attemptNumber - 1), MAX_BACKOFF_SECONDS);
  const runAfter = new Date(Date.now() + backoffSeconds * 1000);

  if (params.attemptId) {
    await dbConn
      .update(jobAttempts)
      .set({
        status: 'failed',
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        endedAt,
      })
      .where(eq(jobAttempts.id, params.attemptId));
  }

  await dbConn
    .update(jobs)
    .set({
      status: 'retrying',
      attemptsCount: params.attemptNumber,
      lockedBy: null,
      lockedAt: null,
      lastErrorCode: params.errorCode,
      lastErrorMessage: params.errorMessage,
      runAfter,
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Moves a job to the dead-letter queue after all retry attempts are exhausted.
 */
export async function deadLetterJob(
  jobId: string,
  params: { attemptNumber: number; errorCode: string; errorMessage: string; attemptId?: string },
  dbConn: Database = db,
): Promise<void> {
  const endedAt = new Date();

  if (params.attemptId) {
    await dbConn
      .update(jobAttempts)
      .set({
        status: 'failed',
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        endedAt,
      })
      .where(eq(jobAttempts.id, params.attemptId));
  }

  await dbConn
    .update(jobs)
    .set({
      status: 'dead_lettered',
      attemptsCount: params.attemptNumber,
      lockedBy: null,
      lockedAt: null,
      lastErrorCode: params.errorCode,
      lastErrorMessage: params.errorMessage,
      failedAt: endedAt,
      deadLetteredAt: endedAt,
    })
    .where(eq(jobs.id, jobId));
}

export interface ZombieJob {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  attemptsCount: number;
  maxAttempts: number;
}

/**
 * Finds jobs stuck in `processing` for longer than `timeoutSeconds` and
 * immediately marks them as `failed`. These are zombie jobs — the Vercel
 * function that claimed them was killed by the platform timeout before it
 * could write a completion or error row.
 *
 * Returns the list of reaped jobs so callers can perform domain-specific
 * cleanup (e.g. marking the associated document as failed).
 */
export async function reapZombieJobs(
  timeoutSeconds: number,
  dbConn: Database = db,
): Promise<ZombieJob[]> {
  const failedAt = new Date();
  const rows = await dbConn.execute(sql`
    UPDATE jobs SET
      status = 'failed',
      locked_by = NULL,
      locked_at = NULL,
      last_error_code = 'TIMEOUT',
      last_error_message = 'Job timed out — the worker was killed before it could finish.',
      failed_at = ${failedAt.toISOString()},
      updated_at = ${failedAt.toISOString()}
    WHERE status = 'processing'
      AND locked_at < now() - (${timeoutSeconds} * interval '1 second')
    RETURNING id, job_type, payload, attempts_count, max_attempts
  `);

  return (
    rows as unknown as {
      id: string;
      job_type: string;
      payload: Record<string, unknown>;
      attempts_count: number;
      max_attempts: number;
    }[]
  ).map((row) => ({
    id: row.id,
    jobType: row.job_type,
    payload: row.payload,
    attemptsCount: row.attempts_count,
    maxAttempts: row.max_attempts,
  }));
}

/**
 * Cancels a job that has not yet been processed.
 */
export async function cancelJob(jobId: string, dbConn: Database = db): Promise<void> {
  await dbConn
    .update(jobs)
    .set({ status: 'canceled', lockedBy: null, lockedAt: null })
    .where(eq(jobs.id, jobId));
}
