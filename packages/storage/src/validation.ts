import type { Database } from '@ai-workspace-lab/db';
import { db } from '@ai-workspace-lab/db';
import {
  EntitlementError,
  FEATURE_KEYS,
  getOrganizationPlan,
  getPlanLimits,
} from '@ai-workspace-lab/entitlements';
import { StorageError } from './errors';

export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'txt', 'md'] as const;
export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

const ALLOWED_CONTENT_TYPES: Record<AllowedFileExtension, string[]> = {
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain'],
};

export function validateFileType(filename: string, contentType: string): void {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext as AllowedFileExtension)) {
    throw new StorageError(
      'INVALID_FILE_TYPE',
      `File type ".${ext}" is not allowed. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`,
    );
  }
  const allowedMimes = ALLOWED_CONTENT_TYPES[ext as AllowedFileExtension];
  if (allowedMimes && !allowedMimes.includes(contentType.toLowerCase())) {
    throw new StorageError(
      'INVALID_FILE_TYPE',
      `Content type "${contentType}" is not valid for .${ext} files`,
    );
  }
}

export function validateFileSize(byteSize: number, maxFileSizeMb: number): void {
  const maxBytes = maxFileSizeMb * 1024 * 1024;
  if (byteSize > maxBytes) {
    throw new StorageError(
      'FILE_TOO_LARGE',
      `File size ${byteSize} bytes exceeds the ${maxFileSizeMb} MB limit (${maxBytes} bytes)`,
    );
  }
}

export const DEFAULT_MAX_FILE_SIZE_MB = 5;

export async function getMaxFileSizeMb(
  organizationId: string,
  dbConn: Database = db,
): Promise<number> {
  try {
    const { subscription } = await getOrganizationPlan(organizationId, dbConn);
    const limits = await getPlanLimits(subscription.planId, FEATURE_KEYS.MAX_FILE_SIZE_MB, dbConn);
    const row = limits[0];
    if (!row) return DEFAULT_MAX_FILE_SIZE_MB;
    if (row.limitValue === null) return Number.POSITIVE_INFINITY;
    return row.limitValue;
  } catch (err) {
    if (err instanceof EntitlementError && err.code === 'NO_ACTIVE_SUBSCRIPTION') {
      throw new StorageError(
        'NOT_AUTHORIZED',
        `Organization ${organizationId} has no active subscription`,
      );
    }
    throw err;
  }
}
