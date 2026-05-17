export { runWorkerOnce } from './worker';
export type { WorkerResult } from './worker';
export { processDocumentHandler, chunkText, extractText } from './handlers/process-document';
export type { ProcessDocumentPayload } from './handlers/process-document';
export {
  createJob,
  claimNextJob,
  startJobAttempt,
  completeJob,
  failJob,
  retryJobWithBackoff,
  deadLetterJob,
  cancelJob,
} from './job-service';
export type { CreateJobParams, ClaimedJob } from './job-service';

import { createJob } from './job-service';

export async function createProcessDocumentJob(
  documentId: string,
  organizationId: string,
): Promise<void> {
  await createJob({
    jobType: 'process_document',
    organizationId,
    payload: { documentId },
    idempotencyKey: `process_document:${documentId}`,
  });
}
