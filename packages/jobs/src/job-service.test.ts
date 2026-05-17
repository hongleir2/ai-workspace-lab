import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ai-workspace-lab/db', () => ({
  db: { execute: vi.fn(), insert: vi.fn(), update: vi.fn() },
  eq: vi.fn().mockReturnValue({}),
  jobAttempts: {},
  jobs: {},
  sql: vi.fn().mockReturnValue({}),
}));

import { db, eq } from '@ai-workspace-lab/db';
import {
  cancelJob,
  claimNextJob,
  completeJob,
  createJob,
  deadLetterJob,
  failJob,
  retryJobWithBackoff,
  startJobAttempt,
} from './job-service';

const JOB_ID = 'job-abc';
const ATTEMPT_ID = 'att-xyz';
const ORG_ID = 'org-123';

function makeInsertConflictChain() {
  const onConflictDoNothing = vi.fn().mockResolvedValue([]);
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  return { values };
}

function makeInsertReturningChain(returnVal: unknown[] = [{ id: ATTEMPT_ID }]) {
  const returning = vi.fn().mockResolvedValue(returnVal);
  const values = vi.fn().mockReturnValue({ returning });
  return { values };
}

function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  return { set };
}

describe('createJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('inserts a job and calls onConflictDoNothing', async () => {
    const conflictChain = makeInsertConflictChain();
    vi.mocked(db.insert).mockReturnValue(conflictChain as never);

    await createJob(
      {
        jobType: 'process_document',
        organizationId: ORG_ID,
        payload: { documentId: 'doc-1' },
        idempotencyKey: 'key-123',
      },
      db as never,
    );

    expect(db.insert).toHaveBeenCalledOnce();
    expect(conflictChain.values).toHaveBeenCalledOnce();
    expect(conflictChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'process_document',
        organizationId: ORG_ID,
        status: 'pending',
        payload: { documentId: 'doc-1' },
        idempotencyKey: 'key-123',
        maxAttempts: 3,
      }),
    );
    expect(conflictChain.values().onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('generates a random idempotency key when none is provided (key must start with jobType:)', async () => {
    const conflictChain = makeInsertConflictChain();
    vi.mocked(db.insert).mockReturnValue(conflictChain as never);

    await createJob(
      {
        jobType: 'process_document',
        organizationId: ORG_ID,
        payload: { documentId: 'doc-1' },
      },
      db as never,
    );

    expect(conflictChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^process_document:/) }),
    );
  });

  it('uses the provided idempotency key when given', async () => {
    const conflictChain = makeInsertConflictChain();
    vi.mocked(db.insert).mockReturnValue(conflictChain as never);

    await createJob(
      {
        jobType: 'process_document',
        organizationId: ORG_ID,
        payload: { documentId: 'doc-1' },
        idempotencyKey: 'custom-key-456',
      },
      db as never,
    );

    expect(conflictChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'custom-key-456' }),
    );
  });

  it('defaults maxAttempts to 3', async () => {
    const conflictChain = makeInsertConflictChain();
    vi.mocked(db.insert).mockReturnValue(conflictChain as never);

    await createJob(
      {
        jobType: 'process_document',
        organizationId: ORG_ID,
        payload: { documentId: 'doc-1' },
      },
      db as never,
    );

    expect(conflictChain.values).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 3 }));
  });
});

describe('claimNextJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('returns null when db.execute returns empty array', async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never);

    const result = await claimNextJob('worker-1', db as never);

    expect(result).toBeNull();
  });

  it('returns a ClaimedJob shape when a row is returned (camelCase mapping from snake_case columns)', async () => {
    const row = {
      id: JOB_ID,
      job_type: 'process_document',
      payload: { documentId: 'doc-1' },
      attempts_count: 1,
      max_attempts: 3,
    };
    vi.mocked(db.execute).mockResolvedValue([row] as never);

    const result = await claimNextJob('worker-1', db as never);

    expect(result).toEqual({
      id: JOB_ID,
      jobType: 'process_document',
      payload: { documentId: 'doc-1' },
      attemptsCount: 1,
      maxAttempts: 3,
    });
  });
});

describe('startJobAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('inserts a job_attempt row and returns the attempt object', async () => {
    const returningChain = makeInsertReturningChain([{ id: ATTEMPT_ID }]);
    vi.mocked(db.insert).mockReturnValue(returningChain as never);

    const result = await startJobAttempt(JOB_ID, 1, db as never);

    expect(db.insert).toHaveBeenCalledOnce();
    expect(returningChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: JOB_ID,
        attemptNumber: 1,
        status: 'started',
      }),
    );
    expect(result).toEqual({ id: ATTEMPT_ID });
  });

  it('returns undefined when the insert returns no rows', async () => {
    const returningChain = makeInsertReturningChain([]);
    vi.mocked(db.insert).mockReturnValue(returningChain as never);

    const result = await startJobAttempt(JOB_ID, 1, db as never);

    expect(result).toBeUndefined();
  });
});

describe('completeJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('calls db.update twice when attemptId is provided (once for job, once for attempt)', async () => {
    let updateCallCount = 0;
    vi.mocked(db.update).mockImplementation(() => {
      updateCallCount += 1;
      return makeUpdateChain() as never;
    });

    await completeJob(JOB_ID, ATTEMPT_ID, 1, db as never);

    expect(updateCallCount).toBe(2);
  });

  it('calls db.update once when attemptId is undefined (job only)', async () => {
    let updateCallCount = 0;
    vi.mocked(db.update).mockImplementation(() => {
      updateCallCount += 1;
      return makeUpdateChain() as never;
    });

    await completeJob(JOB_ID, undefined, 1, db as never);

    expect(updateCallCount).toBe(1);
  });
});

describe('failJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('calls db.update twice when attemptId is provided', async () => {
    let updateCallCount = 0;
    vi.mocked(db.update).mockImplementation(() => {
      updateCallCount += 1;
      return makeUpdateChain() as never;
    });

    await failJob(
      JOB_ID,
      {
        attemptNumber: 1,
        errorCode: 'ERR_PARSE',
        errorMessage: 'Failed to parse',
        attemptId: ATTEMPT_ID,
      },
      db as never,
    );

    expect(updateCallCount).toBe(2);
  });

  it('calls db.update once when attemptId is not provided', async () => {
    let updateCallCount = 0;
    vi.mocked(db.update).mockImplementation(() => {
      updateCallCount += 1;
      return makeUpdateChain() as never;
    });

    await failJob(
      JOB_ID,
      {
        attemptNumber: 1,
        errorCode: 'ERR_PARSE',
        errorMessage: 'Failed to parse',
      },
      db as never,
    );

    expect(updateCallCount).toBe(1);
  });
});

describe('retryJobWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('sets job status to retrying and runAfter approximately 60s from now for attempt 1', async () => {
    const setCalls: Record<string, unknown>[] = [];
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            setCalls.push(args);
            return { where: vi.fn().mockResolvedValue([]) };
          }),
        }) as never,
    );

    const before = Date.now();
    await retryJobWithBackoff(
      JOB_ID,
      { attemptNumber: 1, errorCode: 'ERR', errorMessage: 'err' },
      db as never,
    );

    expect(setCalls).toHaveLength(1);
    const args = setCalls[0] as { status: string; runAfter: Date };
    expect(args.status).toBe('retrying');
    const ms = args.runAfter.getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 60_000);
    expect(ms).toBeLessThanOrEqual(Date.now() + 61_000);
  });

  it('caps backoff at 86400 seconds (24h) for high attempt numbers like 10', async () => {
    const setCalls: Record<string, unknown>[] = [];
    vi.mocked(db.update).mockImplementation(
      () =>
        ({
          set: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            setCalls.push(args);
            return { where: vi.fn().mockResolvedValue([]) };
          }),
        }) as never,
    );

    const before = Date.now();
    await retryJobWithBackoff(
      JOB_ID,
      { attemptNumber: 10, errorCode: 'ERR', errorMessage: 'err' },
      db as never,
    );

    expect(setCalls).toHaveLength(1);
    const args = setCalls[0] as { status: string; runAfter: Date };
    expect(args.status).toBe('retrying');
    const ms = args.runAfter.getTime();
    const maxBackoffMs = 86400 * 1000;
    expect(ms).toBeLessThanOrEqual(before + maxBackoffMs + 1000);
    expect(ms).toBeGreaterThan(before);
  });
});

describe('deadLetterJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('calls db.update twice when attemptId is provided (attempt + job)', async () => {
    let updateCallCount = 0;
    vi.mocked(db.update).mockImplementation(() => {
      updateCallCount += 1;
      return makeUpdateChain() as never;
    });

    await deadLetterJob(
      JOB_ID,
      {
        attemptNumber: 3,
        errorCode: 'ERR_MAX_RETRIES',
        errorMessage: 'Max retries exceeded',
        attemptId: ATTEMPT_ID,
      },
      db as never,
    );

    expect(updateCallCount).toBe(2);
  });

  it('calls db.update once when no attemptId', async () => {
    let updateCallCount = 0;
    vi.mocked(db.update).mockImplementation(() => {
      updateCallCount += 1;
      return makeUpdateChain() as never;
    });

    await deadLetterJob(
      JOB_ID,
      {
        attemptNumber: 3,
        errorCode: 'ERR_MAX_RETRIES',
        errorMessage: 'Max retries exceeded',
      },
      db as never,
    );

    expect(updateCallCount).toBe(1);
  });
});

describe('cancelJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('calls db.update once to set status to canceled', async () => {
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await cancelJob(JOB_ID, db as never);

    expect(db.update).toHaveBeenCalledOnce();
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'canceled',
        lockedBy: null,
        lockedAt: null,
      }),
    );
  });
});
