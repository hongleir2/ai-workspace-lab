import { type Document, type NewDocument, db, documents } from '@ai-workspace-lab/db';
import {
  EntitlementError,
  FEATURE_KEYS,
  assertFeatureAllowed,
  getCurrentBillingPeriod,
  getOrganizationPlan,
  getPlanLimits,
} from '@ai-workspace-lab/entitlements';
import { createProcessDocumentJob } from '@ai-workspace-lab/jobs';
import {
  createStorageObjectRow,
  createUploadTarget,
  getMaxFileSizeMb,
} from '@ai-workspace-lab/storage';
import { recordUsageWithCounter } from '@ai-workspace-lab/usage';
import { triggerWorker } from '../jobs/trigger';

export interface CreateDocumentUploadTargetInput {
  organizationId: string;
  userId: string;
  filename: string;
  contentType: string;
  byteSize: number;
}

export interface CreateDocumentUploadTargetResult {
  document: Document;
  uploadUrl: string;
}

export async function createDocumentUploadTarget(
  input: CreateDocumentUploadTargetInput,
): Promise<CreateDocumentUploadTargetResult> {
  const { organizationId, userId, filename, contentType, byteSize } = input;

  await assertFeatureAllowed(organizationId, FEATURE_KEYS.DOCUMENT_UPLOADS);

  const maxFileSizeMb = await getMaxFileSizeMb(organizationId);
  const { uploadUrl, objectKey, bucket } = await createUploadTarget({
    organizationId,
    userId,
    filename,
    contentType,
    byteSize,
    maxFileSizeMb,
  });

  const storageObject = await createStorageObjectRow({
    organizationId,
    uploadedByUserId: userId,
    objectKey,
    bucket,
    originalFilename: filename,
    contentType,
    byteSize,
  });

  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot >= 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
  const newDoc: NewDocument = {
    organizationId,
    storageObjectId: storageObject.id,
    createdByUserId: userId,
    title: filename,
    sourceType: 'web_upload',
    fileType: ext,
    status: 'queued',
  };

  const [document] = await db.insert(documents).values(newDoc).returning();
  if (!document) throw new Error('Failed to create document row');

  const planResult = await getOrganizationPlan(organizationId).catch((err: unknown) => {
    if (err instanceof EntitlementError && err.code === 'NO_ACTIVE_SUBSCRIPTION') return null;
    throw err;
  });
  const subscription = planResult?.subscription;
  const limits = subscription
    ? await getPlanLimits(subscription.planId, FEATURE_KEYS.DOCUMENT_UPLOADS)
    : [];
  const resetInterval = limits[0]?.resetInterval ?? 'day';
  const period = (subscription ? getCurrentBillingPeriod(subscription, resetInterval) : null) ?? {
    start: new Date(new Date().setUTCHours(0, 0, 0, 0)),
    end: new Date(new Date().setUTCHours(23, 59, 59, 999)),
  };

  // Known limitation: if recordUsageWithCounter fails after the document row is created,
  // the document exists but usage is not recorded (quota hole). Deferred to a future
  // compensating background job once the processing pipeline is in place.
  await recordUsageWithCounter({
    event: {
      organizationId,
      userId,
      featureKey: FEATURE_KEYS.DOCUMENT_UPLOADS,
      eventType: 'document_upload',
      quantity: '1',
      unit: 'count',
      sourceType: 'document',
      sourceId: document.id,
      idempotencyKey: document.id,
    },
    period,
  });

  await createProcessDocumentJob(document.id, organizationId);
  // Awaited so Vercel doesn't kill the function before the QStash publish
  // completes. If QStash is unavailable, the job stays pending until the
  // Vercel cron safety net picks it up.
  await triggerWorker().catch(() => {});

  return { document, uploadUrl };
}
