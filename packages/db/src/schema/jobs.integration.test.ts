/**
 * Integration test for the jobs migration (0011) and job_attempts migration (0012).
 *
 * Requires a real Postgres with migrations applied:
 *   supabase start && pnpm db:migrate
 *
 * Skipped automatically when DATABASE_URL is absent.
 */

import { like } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jobAttempts, jobs } from './index.js';

const DATABASE_URL = process.env['DATABASE_URL'];

// Stable prefix for all idempotency keys created by this suite.
// Used in beforeAll to scrub leftovers from crashed prior runs.
const TEST_KEY_PREFIX = 'integration-test-jobs-';

describe.skipIf(!DATABASE_URL)('jobs and job_attempts tables', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  let insertedJobId: string;

  beforeAll(async () => {
    // Delete any jobs (and their attempts via cascade) left over from prior crashed runs.
    const stale = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(like(jobs.idempotencyKey, `${TEST_KEY_PREFIX}%`));
    for (const row of stale) {
      await db
        .delete(jobAttempts)
        .where(eq(jobAttempts.jobId, row.id))
        .catch(() => {});
      await db
        .delete(jobs)
        .where(eq(jobs.id, row.id))
        .catch(() => {});
    }
  });

  afterAll(async () => {
    if (insertedJobId) {
      await db
        .delete(jobAttempts)
        .where(eq(jobAttempts.jobId, insertedJobId))
        .catch(() => {});
      await db
        .delete(jobs)
        .where(eq(jobs.id, insertedJobId))
        .catch(() => {});
    }
    await client.end();
  });

  it('inserts a job with default status and timestamps', async () => {
    const [job] = await db
      .insert(jobs)
      .values({
        jobType: 'process_document',
        status: 'pending',
        payload: { documentId: 'test-id-001' },
        idempotencyKey: `${TEST_KEY_PREFIX}${Date.now()}`,
      })
      .returning();

    expect(job).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    insertedJobId = job!.id;
    expect(job?.jobType).toBe('process_document');
    expect(job?.status).toBe('pending');
    expect(job?.attemptsCount).toBe(0);
    expect(job?.maxAttempts).toBe(3);
    expect(job?.payload).toEqual({ documentId: 'test-id-001' });
    expect(job?.createdAt).toBeInstanceOf(Date);
    expect(job?.updatedAt).toBeInstanceOf(Date);
    expect(job?.runAfter).toBeInstanceOf(Date);
  });

  it('enforces unique idempotency_key constraint', async () => {
    const key = `${TEST_KEY_PREFIX}idempotent-${Date.now()}`;
    const [job] = await db
      .insert(jobs)
      .values({
        jobType: 'process_document',
        idempotencyKey: key,
      })
      .returning();

    expect(job).toBeDefined();

    await expect(
      db.insert(jobs).values({
        jobType: 'process_document',
        idempotencyKey: key,
      }),
    ).rejects.toThrow();

    // Cleanup
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    await db.delete(jobs).where(eq(jobs.id, job!.id));
  });

  it('inserts a job_attempt with default status', async () => {
    const [attempt] = await db
      .insert(jobAttempts)
      .values({
        jobId: insertedJobId,
        attemptNumber: 1,
      })
      .returning();

    expect(attempt).toBeDefined();
    expect(attempt?.jobId).toBe(insertedJobId);
    expect(attempt?.attemptNumber).toBe(1);
    expect(attempt?.status).toBe('started');
    expect(attempt?.startedAt).toBeInstanceOf(Date);
    expect(attempt?.endedAt).toBeNull();
    expect(attempt?.errorCode).toBeNull();
    expect(attempt?.metadata).toEqual({});

    // Cleanup
    await db.delete(jobAttempts).where(eq(jobAttempts.jobId, insertedJobId));
  });

  it('enforces unique (job_id, attempt_number) constraint', async () => {
    const [attempt1] = await db
      .insert(jobAttempts)
      .values({
        jobId: insertedJobId,
        attemptNumber: 1,
      })
      .returning();

    expect(attempt1).toBeDefined();

    await expect(
      db.insert(jobAttempts).values({
        jobId: insertedJobId,
        attemptNumber: 1,
      }),
    ).rejects.toThrow();

    // Cleanup
    await db.delete(jobAttempts).where(eq(jobAttempts.jobId, insertedJobId));
  });

  it('records error details on job_attempt', async () => {
    const [attempt] = await db
      .insert(jobAttempts)
      .values({
        jobId: insertedJobId,
        attemptNumber: 1,
        status: 'failed',
        errorCode: 'PARSE_ERROR',
        errorMessage: 'Failed to parse document structure',
        metadata: { retryable: true },
      })
      .returning();

    expect(attempt?.status).toBe('failed');
    expect(attempt?.errorCode).toBe('PARSE_ERROR');
    expect(attempt?.errorMessage).toBe('Failed to parse document structure');
    expect(attempt?.metadata).toEqual({ retryable: true });

    // Cleanup
    await db.delete(jobAttempts).where(eq(jobAttempts.jobId, insertedJobId));
  });

  it('job can reference organization and created_by user (optional FKs)', async () => {
    const [job] = await db
      .insert(jobs)
      .values({
        organizationId: null,
        createdByUserId: null,
        jobType: 'system_task',
        idempotencyKey: `${TEST_KEY_PREFIX}sys-${Date.now()}`,
      })
      .returning();

    expect(job).toBeDefined();
    expect(job?.organizationId).toBeNull();
    expect(job?.createdByUserId).toBeNull();

    // Cleanup
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    await db.delete(jobs).where(eq(jobs.id, job!.id));
  });

  it('updates job status and timestamps correctly', async () => {
    const [before] = await db.select().from(jobs).where(eq(jobs.id, insertedJobId));
    const originalUpdatedAt = before?.updatedAt;

    await new Promise((r) => setTimeout(r, 50));

    await db
      .update(jobs)
      .set({ status: 'processing', lockedBy: 'worker-1' })
      .where(eq(jobs.id, insertedJobId));

    const [after] = await db.select().from(jobs).where(eq(jobs.id, insertedJobId));
    expect(after?.status).toBe('processing');
    expect(after?.lockedBy).toBe('worker-1');
    expect(after?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() ?? 0);
  });
});
