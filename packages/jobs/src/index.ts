export { runWorkerOnce } from './worker';
export type { WorkerResult } from './worker';
export {
  processDocumentHandler,
  chunkTextByTokens,
  extractText,
} from './handlers/process-document';
export type { ProcessDocumentPayload } from './handlers/process-document';
export {
  createJob,
  claimNextJob,
  reapZombieJobs,
  startJobAttempt,
  completeJob,
  failJob,
  retryJobWithBackoff,
  deadLetterJob,
  cancelJob,
} from './job-service';
export type { CreateJobParams, ClaimedJob, ZombieJob } from './job-service';

import { createLogger } from '@ai-workspace-lab/logger';
import { createJob } from './job-service';

const logger = createLogger('jobs/index');

export async function createProcessDocumentJob(
  documentId: string,
  organizationId: string,
): Promise<void> {
  const idempotencyKey = `process_document:${documentId}`;
  logger.debug('job.enqueue.attempt', { documentId, organizationId, idempotencyKey });

  await createJob({
    jobType: 'process_document',
    organizationId,
    payload: { documentId },
    idempotencyKey,
  });

  logger.debug('job.enqueue.done', { documentId, organizationId, idempotencyKey });
}
