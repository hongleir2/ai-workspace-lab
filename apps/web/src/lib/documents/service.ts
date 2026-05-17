import { type Document, type NewDocument, db, documents } from '@ai-workspace-lab/db';
import {
  assertFeatureAllowed,
  getCurrentBillingPeriod,
  getOrganizationPlan,
  getPlanLimits,
} from '@ai-workspace-lab/entitlements';
import {
  createStorageObjectRow,
  createUploadTarget,
  getMaxFileSizeMb,
} from '@ai-workspace-lab/storage';
import { recordUsageWithCounter } from '@ai-workspace-lab/usage';

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

  await assertFeatureAllowed(organizationId, 'document_uploads');

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

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const newDoc: NewDocument = {
    organizationId,
    storageObjectId: storageObject.id,
    createdByUserId: userId,
    title: filename,
    sourceType: 'web_upload',
    fileType: ext,
    status: 'uploaded',
  };

  const [document] = await db.insert(documents).values(newDoc).returning();
  if (!document) throw new Error('Failed to create document row');

  const { subscription } = await getOrganizationPlan(organizationId);
  const limits = await getPlanLimits(subscription.planId, 'document_uploads');
  const resetInterval = limits[0]?.resetInterval ?? 'day';
  const period = getCurrentBillingPeriod(subscription, resetInterval) ?? {
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
      featureKey: 'document_uploads',
      eventType: 'document_upload',
      quantity: '1',
      unit: 'count',
      sourceType: 'document',
      sourceId: document.id,
      idempotencyKey: document.id,
    },
    period,
  });

  return { document, uploadUrl };
}
