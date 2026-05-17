import { randomUUID } from 'node:crypto';
import {
  type Database,
  type StorageObject,
  and,
  db,
  eq,
  organizationMemberships,
  storageObjects,
} from '@ai-workspace-lab/db';
import { StorageError } from './errors';
import { getStorageProvider } from './providers/index';
import type { ObjectMetadata, StorageProvider, UploadObjectParams, UploadTarget } from './types';
import { validateFileSize, validateFileType } from './validation';

async function assertCanUploadToOrg(
  userId: string,
  organizationId: string,
  dbConn: Database,
): Promise<void> {
  const rows = await dbConn
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    throw new StorageError(
      'NOT_AUTHORIZED',
      `User ${userId} is not an active member of organization ${organizationId}`,
    );
  }
}

export interface CreateUploadTargetInput {
  organizationId: string;
  userId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  maxFileSizeMb: number;
}

export async function createUploadTarget(
  input: CreateUploadTargetInput,
  provider: StorageProvider = getStorageProvider(),
  dbConn: Database = db,
): Promise<UploadTarget> {
  validateFileType(input.filename, input.contentType);
  validateFileSize(input.byteSize, input.maxFileSizeMb);
  await assertCanUploadToOrg(input.userId, input.organizationId, dbConn);

  const ext = input.filename.split('.').pop()?.toLowerCase() ?? '';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const objectKey = `organizations/${input.organizationId}/uploads/${yyyy}/${mm}/${randomUUID()}.${ext}`;

  return provider.createUploadTarget({ objectKey, contentType: input.contentType });
}

export async function uploadObject(
  params: UploadObjectParams,
  provider: StorageProvider = getStorageProvider(),
): Promise<void> {
  return provider.uploadObject(params);
}

export async function getObjectMetadata(
  objectKey: string,
  provider: StorageProvider = getStorageProvider(),
): Promise<ObjectMetadata> {
  return provider.getObjectMetadata(objectKey);
}

export async function deleteObject(
  objectKey: string,
  provider: StorageProvider = getStorageProvider(),
): Promise<void> {
  return provider.deleteObject(objectKey);
}

export interface CreateStorageObjectRowParams {
  organizationId: string;
  uploadedByUserId: string;
  objectKey: string;
  bucket: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  checksumSha256?: string;
}

export async function createStorageObjectRow(
  params: CreateStorageObjectRowParams,
  dbConn: Database = db,
): Promise<StorageObject> {
  const values: typeof storageObjects.$inferInsert = {
    organizationId: params.organizationId,
    uploadedByUserId: params.uploadedByUserId,
    objectKey: params.objectKey,
    bucket: params.bucket,
    originalFilename: params.originalFilename,
    contentType: params.contentType,
    byteSize: params.byteSize,
    status: 'uploaded',
  };
  if (params.checksumSha256 !== undefined) {
    values.checksumSha256 = params.checksumSha256;
  }

  const [row] = await dbConn.insert(storageObjects).values(values).returning();
  if (!row) throw new StorageError('DATABASE_ERROR', 'Failed to insert storage_objects row');
  return row;
}
