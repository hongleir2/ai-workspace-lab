import type { Document } from '@ai-workspace-lab/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentUploadTarget } from './service';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

vi.mock('@ai-workspace-lab/entitlements', () => ({
  assertFeatureAllowed: vi.fn(),
  getOrganizationPlan: vi.fn(),
  getPlanLimits: vi.fn(),
  getCurrentBillingPeriod: vi.fn(),
  EntitlementError: class EntitlementError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = 'EntitlementError';
    }
  },
}));

vi.mock('@ai-workspace-lab/storage', () => ({
  getMaxFileSizeMb: vi.fn(),
  createUploadTarget: vi.fn(),
  createStorageObjectRow: vi.fn(),
  StorageError: class StorageError extends Error {
    code: string;
    constructor(code: string, msg: string) {
      super(msg);
      this.code = code;
      this.name = 'StorageError';
    }
  },
}));

vi.mock('@ai-workspace-lab/usage', () => ({
  recordUsageWithCounter: vi.fn(),
}));

vi.mock('@ai-workspace-lab/db', () => {
  const insert = vi.fn();
  const values = vi.fn();
  const returning = vi.fn();
  values.mockReturnValue({ returning });
  insert.mockReturnValue({ values });
  return {
    db: { insert },
    documents: {},
  };
});

import { db } from '@ai-workspace-lab/db';
// ── Import mocked modules for assertion access ────────────────────────────────
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

// ── Test constants ────────────────────────────────────────────────────────────
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const DOC_ID = '00000000-0000-0000-0000-000000000003';
const STORAGE_OBJ_ID = '00000000-0000-0000-0000-000000000004';

const MOCK_UPLOAD_TARGET = {
  uploadUrl: 'https://r2.example.com/presigned',
  objectKey: `organizations/${ORG_ID}/uploads/2026/05/uuid.pdf`,
  bucket: 'documents',
  expiresAt: new Date(Date.now() + 900_000),
};

const MOCK_STORAGE_OBJECT = {
  id: STORAGE_OBJ_ID,
  organizationId: ORG_ID,
  uploadedByUserId: USER_ID,
  objectKey: MOCK_UPLOAD_TARGET.objectKey,
  bucket: 'documents',
  originalFilename: 'report.pdf',
  contentType: 'application/pdf',
  byteSize: 1024,
  status: 'uploaded',
  checksumSha256: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_DOCUMENT: Document = {
  id: DOC_ID,
  organizationId: ORG_ID,
  storageObjectId: STORAGE_OBJ_ID,
  createdByUserId: USER_ID,
  title: 'report.pdf',
  sourceType: 'web_upload',
  fileType: 'pdf',
  status: 'uploaded',
  processingErrorCode: null,
  processingErrorMessage: null,
  pageCount: null,
  language: null,
  checksumSha256: null,
  readyAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const MOCK_SUBSCRIPTION = {
  id: 'sub-1',
  planId: 'plan-pro',
  organizationId: ORG_ID,
  status: 'active',
  currentPeriodStart: new Date('2026-05-01'),
  currentPeriodEnd: new Date('2026-06-01'),
} as never;

const MOCK_PERIOD = { start: new Date('2026-05-01'), end: new Date('2026-06-01') };

function setupHappyPath() {
  vi.mocked(assertFeatureAllowed).mockResolvedValue(undefined);
  vi.mocked(getMaxFileSizeMb).mockResolvedValue(50);
  vi.mocked(createUploadTarget).mockResolvedValue(MOCK_UPLOAD_TARGET);
  vi.mocked(createStorageObjectRow).mockResolvedValue(MOCK_STORAGE_OBJECT as never);
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
    values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([MOCK_DOCUMENT]) }),
  });
  vi.mocked(getOrganizationPlan).mockResolvedValue({
    subscription: MOCK_SUBSCRIPTION,
    plan: { id: 'plan-pro' } as never,
  });
  vi.mocked(getPlanLimits).mockResolvedValue([
    { resetInterval: 'billing_period', limitValue: 100 } as never,
  ]);
  vi.mocked(getCurrentBillingPeriod).mockReturnValue(MOCK_PERIOD);
  vi.mocked(recordUsageWithCounter).mockResolvedValue({ inserted: true, event: {} as never });
}

describe('createDocumentUploadTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns document and uploadUrl on happy path', async () => {
    setupHappyPath();

    const result = await createDocumentUploadTarget({
      organizationId: ORG_ID,
      userId: USER_ID,
      filename: 'report.pdf',
      contentType: 'application/pdf',
      byteSize: 1024,
    });

    expect(result.uploadUrl).toBe(MOCK_UPLOAD_TARGET.uploadUrl);
    expect(result.document.id).toBe(DOC_ID);
    expect(result.document.status).toBe('uploaded');
    expect(result.document.sourceType).toBe('web_upload');
  });

  it('calls assertFeatureAllowed with document_uploads', async () => {
    setupHappyPath();
    await createDocumentUploadTarget({
      organizationId: ORG_ID,
      userId: USER_ID,
      filename: 'report.pdf',
      contentType: 'application/pdf',
      byteSize: 1024,
    });
    expect(assertFeatureAllowed).toHaveBeenCalledWith(ORG_ID, 'document_uploads');
  });

  it('bubbles EntitlementError(QUOTA_EXCEEDED) from assertFeatureAllowed', async () => {
    const { EntitlementError: MockEntitlementError } = await import(
      '@ai-workspace-lab/entitlements'
    );
    vi.mocked(assertFeatureAllowed).mockRejectedValue(new MockEntitlementError('QUOTA_EXCEEDED'));

    await expect(
      createDocumentUploadTarget({
        organizationId: ORG_ID,
        userId: USER_ID,
        filename: 'report.pdf',
        contentType: 'application/pdf',
        byteSize: 1024,
      }),
    ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });

    expect(createUploadTarget).not.toHaveBeenCalled();
  });

  it('bubbles StorageError(INVALID_FILE_TYPE) from createUploadTarget', async () => {
    vi.mocked(assertFeatureAllowed).mockResolvedValue(undefined);
    vi.mocked(getMaxFileSizeMb).mockResolvedValue(50);
    const { StorageError: MockStorageError } = await import('@ai-workspace-lab/storage');
    vi.mocked(createUploadTarget).mockRejectedValue(
      new MockStorageError('INVALID_FILE_TYPE', 'Not allowed'),
    );

    await expect(
      createDocumentUploadTarget({
        organizationId: ORG_ID,
        userId: USER_ID,
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        byteSize: 1024,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
  });

  it('records usage with document id as idempotencyKey', async () => {
    setupHappyPath();
    await createDocumentUploadTarget({
      organizationId: ORG_ID,
      userId: USER_ID,
      filename: 'report.pdf',
      contentType: 'application/pdf',
      byteSize: 1024,
    });

    expect(recordUsageWithCounter).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          organizationId: ORG_ID,
          featureKey: 'document_uploads',
          idempotencyKey: DOC_ID,
        }),
        period: MOCK_PERIOD,
      }),
    );
  });

  it('documents quota-hole: document row exists when recordUsageWithCounter fails', async () => {
    setupHappyPath();
    vi.mocked(recordUsageWithCounter).mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(
      createDocumentUploadTarget({
        organizationId: ORG_ID,
        userId: USER_ID,
        filename: 'report.pdf',
        contentType: 'application/pdf',
        byteSize: 1024,
      }),
    ).rejects.toThrow('DB connection lost');

    // document insert was called before usage recording — the row exists but quota is not counted
    expect(db.insert).toHaveBeenCalled();
    expect(recordUsageWithCounter).toHaveBeenCalled();
  });

  it('passes fileType as extension extracted from filename', async () => {
    setupHappyPath();
    await createDocumentUploadTarget({
      organizationId: ORG_ID,
      userId: USER_ID,
      filename: 'notes.txt',
      contentType: 'text/plain',
      byteSize: 512,
    });
    const valuesMock = vi.mocked(db.insert).mock.results[0]?.value as {
      values: ReturnType<typeof vi.fn>;
    };
    const docArg = valuesMock.values.mock.calls[0]?.[0] as { fileType: string };
    expect(docArg?.fileType).toBe('txt');
  });
});
