import type { Database } from '@ai-workspace-lab/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageError } from './errors';
import { createUploadTarget } from './service';
import type { StorageProvider, UploadTarget } from './types';

const mockUploadTarget: UploadTarget = {
  uploadUrl: 'https://example.com/upload/presigned',
  objectKey: 'organizations/org-1/uploads/2026/05/uuid.pdf',
  bucket: 'documents',
  expiresAt: new Date(Date.now() + 900_000),
};

const mockProvider: StorageProvider = {
  createUploadTarget: vi.fn().mockResolvedValue(mockUploadTarget),
  uploadObject: vi.fn().mockResolvedValue(undefined),
  getObjectMetadata: vi.fn().mockResolvedValue({ contentType: 'application/pdf', byteSize: 1024 }),
  deleteObject: vi.fn().mockResolvedValue(undefined),
};

const MB = 1024 * 1024;
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

// Create a mock database that supports the fluent query API
function createMockDb(): Database {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: 'membership-id' }]),
  } as unknown as Database;
}

describe('createUploadTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid file type before calling provider', async () => {
    let caught: unknown;
    try {
      await createUploadTarget(
        {
          organizationId: ORG_ID,
          userId: USER_ID,
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
          byteSize: 1024,
          maxFileSizeMb: 5,
        },
        mockProvider,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe('INVALID_FILE_TYPE');
    expect(mockProvider.createUploadTarget).not.toHaveBeenCalled();
  });

  it('rejects file over size limit before calling provider', async () => {
    let caught: unknown;
    try {
      await createUploadTarget(
        {
          organizationId: ORG_ID,
          userId: USER_ID,
          filename: 'report.pdf',
          contentType: 'application/pdf',
          byteSize: 6 * MB,
          maxFileSizeMb: 5,
        },
        mockProvider,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe('FILE_TOO_LARGE');
    expect(mockProvider.createUploadTarget).not.toHaveBeenCalled();
  });

  it('returns upload target for valid PDF', async () => {
    const mockDb = createMockDb();

    const result = await createUploadTarget(
      {
        organizationId: ORG_ID,
        userId: USER_ID,
        filename: 'report.pdf',
        contentType: 'application/pdf',
        byteSize: 1024,
        maxFileSizeMb: 5,
      },
      mockProvider,
      mockDb,
    );
    expect(result.uploadUrl).toBe('https://example.com/upload/presigned');
    expect(result.bucket).toBe('documents');
  });

  it('rejects non-member before calling provider', async () => {
    const nonMemberDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // no membership row
    } as unknown as Database;

    let caught: unknown;
    try {
      await createUploadTarget(
        {
          organizationId: ORG_ID,
          userId: USER_ID,
          filename: 'report.pdf',
          contentType: 'application/pdf',
          byteSize: 1024,
          maxFileSizeMb: 5,
        },
        mockProvider,
        nonMemberDb,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe('NOT_AUTHORIZED');
    expect(mockProvider.createUploadTarget).not.toHaveBeenCalled();
  });

  it('generates objectKey in organizations/{orgId}/uploads/{yyyy}/{mm}/{uuid}.{ext} format', async () => {
    const mockDb = createMockDb();

    await createUploadTarget(
      {
        organizationId: ORG_ID,
        userId: USER_ID,
        filename: 'notes.txt',
        contentType: 'text/plain',
        byteSize: 512,
        maxFileSizeMb: 5,
      },
      mockProvider,
      mockDb,
    );
    const call = (mockProvider.createUploadTarget as ReturnType<typeof vi.fn>).mock.calls[0];
    const params = call?.[0] as { objectKey: string };
    expect(params.objectKey).toMatch(
      new RegExp(`^organizations/${ORG_ID}/uploads/\\d{4}/\\d{2}/[0-9a-f-]+\\.txt$`),
    );
  });
});
