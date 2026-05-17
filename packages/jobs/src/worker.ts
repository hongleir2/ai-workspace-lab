import { randomUUID } from 'node:crypto';
import { type Database, db, documents, eq } from '@ai-workspace-lab/db';
import { processDocumentHandler } from './handlers/process-document';
import type { ProcessDocumentPayload } from './handlers/process-document';
import {
  claimNextJob,
  completeJob,
  deadLetterJob,
  reapZombieJobs,
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

  // Reap zombie jobs (stuck in `processing` for > 120s) before claiming a new one.
  // 120s is 2× the 60s Vercel maxDuration — anything older is guaranteed to be dead.
  const zombies = await reapZombieJobs(120, dbConn);
  for (const zombie of zombies) {
    if (zombie.jobType === 'process_document') {
      const { documentId } = zombie.payload as unknown as ProcessDocumentPayload;
      await dbConn
        .update(documents)
        .set({
          status: 'failed',
          processingErrorCode: 'TIMEOUT',
          processingErrorMessage:
            'Processing timed out. Try uploading a smaller file (first 10 pages are processed).',
        })
        .where(eq(documents.id, documentId));
    }
  }

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
