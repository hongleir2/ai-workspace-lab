import { randomUUID } from 'node:crypto';
import { type Database, db } from '@ai-workspace-lab/db';
import { processDocumentHandler } from './handlers/process-document';
import type { ProcessDocumentPayload } from './handlers/process-document';
import {
  claimNextJob,
  completeJob,
  deadLetterJob,
  retryJobWithBackoff,
  startJobAttempt,
} from './job-service';

export interface WorkerResult {
  processed: number;
  jobId?: string;
  status?: string;
  error?: string;
}

export async function runWorkerOnce(dbConn: Database = db): Promise<WorkerResult> {
  const workerId = `worker-${randomUUID().slice(0, 8)}`;

  const claimed = await claimNextJob(workerId, dbConn);
  if (!claimed) return { processed: 0 };

  const { id: jobId, attemptsCount, maxAttempts } = claimed;
  const attemptNumber = attemptsCount + 1;
  let attempt: { id: string } | undefined;

  try {
    attempt = await startJobAttempt(jobId, attemptNumber, dbConn);

    if (claimed.jobType === 'process_document') {
      await processDocumentHandler(claimed.payload as unknown as ProcessDocumentPayload, dbConn);
    } else {
      throw new Error(`Unknown job type: ${claimed.jobType}`);
    }

    await completeJob(jobId, attempt?.id, attemptNumber, dbConn);
    return { processed: 1, jobId, status: 'completed' };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode = (err as { code?: string }).code ?? 'UNKNOWN_ERROR';
    const isExhausted = attemptNumber >= maxAttempts;

    if (isExhausted) {
      await deadLetterJob(
        jobId,
        { attemptNumber, errorCode, errorMessage, ...(attempt ? { attemptId: attempt.id } : {}) },
        dbConn,
      );
      return { processed: 1, jobId, status: 'dead_lettered', error: errorMessage };
    }

    await retryJobWithBackoff(
      jobId,
      { attemptNumber, errorCode, errorMessage, ...(attempt ? { attemptId: attempt.id } : {}) },
      dbConn,
    );
    return { processed: 1, jobId, status: 'retrying', error: errorMessage };
  }
}
