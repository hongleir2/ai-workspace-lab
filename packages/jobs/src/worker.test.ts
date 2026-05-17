import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ai-workspace-lab/db', () => ({
  db: { execute: vi.fn(), insert: vi.fn(), update: vi.fn() },
  eq: vi.fn().mockReturnValue({}),
  documents: {},
  jobAttempts: {},
  jobs: {},
  sql: vi.fn().mockReturnValue({}),
}));

vi.mock('./handlers/process-document', () => ({
  processDocumentHandler: vi.fn(),
}));

import { db, eq } from '@ai-workspace-lab/db';
import { processDocumentHandler } from './handlers/process-document';
import { runWorkerOnce } from './worker';

const JOB_ID = 'job-abc';
const ATTEMPT_ID = 'att-xyz';

function makeClaimedRow(
  overrides: Partial<{
    id: string;
    job_type: string;
    payload: Record<string, unknown>;
    attempts_count: number;
    max_attempts: number;
  }> = {},
) {
  return {
    id: JOB_ID,
    job_type: 'process_document',
    payload: { documentId: 'doc-1' },
    attempts_count: 0,
    max_attempts: 3,
    ...overrides,
  };
}

function makeInsertChain(returnVal: unknown[] = [{ id: ATTEMPT_ID }]) {
  const returning = vi.fn().mockResolvedValue(returnVal);
  const values = vi.fn().mockReturnValue({ returning });
  return { values };
}

function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  return { set };
}

describe('runWorkerOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(eq).mockReturnValue({} as never);
  });

  it('returns processed=0 when no pending jobs', async () => {
    // First execute = zombie reap (no zombies), second = claim (no jobs)
    vi.mocked(db.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const result = await runWorkerOnce(db as never);
    expect(result).toEqual({ processed: 0 });
  });

  it('dispatches process_document handler and marks job completed', async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([makeClaimedRow()] as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(processDocumentHandler).mockResolvedValue(undefined);

    const result = await runWorkerOnce(db as never);

    expect(processDocumentHandler).toHaveBeenCalledOnce();
    expect(result.processed).toBe(1);
    expect(result.status).toBe('completed');
    expect(result.jobId).toBe(JOB_ID);
  });

  it('records job_attempt row on start', async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([makeClaimedRow()] as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(processDocumentHandler).mockResolvedValue(undefined);

    await runWorkerOnce(db as never);

    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('sets job to retrying on failure with attempts remaining', async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([makeClaimedRow({ attempts_count: 0, max_attempts: 3 })] as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(processDocumentHandler).mockRejectedValue(new Error('parse failed'));

    const result = await runWorkerOnce(db as never);

    expect(result.status).toBe('retrying');
    expect(result.error).toBe('parse failed');
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('dead-letters job when max attempts are exhausted', async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([makeClaimedRow({ attempts_count: 2, max_attempts: 3 })] as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(processDocumentHandler).mockRejectedValue(new Error('fatal'));

    const result = await runWorkerOnce(db as never);

    expect(result.status).toBe('dead_lettered');
    expect(result.error).toBe('fatal');
  });

  it('marks attempt and job on success', async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([makeClaimedRow()] as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([{ id: ATTEMPT_ID }]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(processDocumentHandler).mockResolvedValue(undefined);

    await runWorkerOnce(db as never);

    // update called twice: job completed + attempt succeeded
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('handles unknown job type by dead-lettering when max attempts hit', async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        makeClaimedRow({ job_type: 'unknown_type', attempts_count: 2, max_attempts: 3 }),
      ] as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await runWorkerOnce(db as never);

    expect(result.status).toBe('dead_lettered');
    expect(result.error).toContain('Unknown job type');
  });

  it('retries unknown job type when attempts remain', async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        makeClaimedRow({ job_type: 'unknown_type', attempts_count: 0, max_attempts: 3 }),
      ] as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await runWorkerOnce(db as never);

    expect(result.status).toBe('retrying');
    expect(result.error).toContain('Unknown job type');
  });
});
