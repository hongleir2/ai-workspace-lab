import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/axiom/server', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/auth/user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/orgs/service', () => ({
  getOrganizationBySlug: vi.fn(),
}));

vi.mock('@/lib/analytics/flags', () => ({
  getServerFeatureFlag: vi.fn(),
  FLAGS: {
    DOCUMENT_UPLOAD: 'document_upload_enabled',
    AI_CHAT: 'ai_chat_enabled',
    RAG_V1: 'rag_v1_enabled',
    DESKTOP_UPLOAD: 'desktop_upload_enabled',
    REALTIME_STATUS: 'realtime_status_enabled',
  },
}));

vi.mock('@/lib/documents/service', () => ({
  createDocumentUploadTarget: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_POSTHOG_KEY: undefined },
}));

vi.mock('@ai-workspace-lab/entitlements', () => ({
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
  StorageError: class StorageError extends Error {
    code: string;
    constructor(code: string, msg: string) {
      super(msg);
      this.code = code;
      this.name = 'StorageError';
    }
  },
}));

vi.mock('@ai-workspace-lab/db', () => {
  const limit = vi.fn();
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return {
    db: { select },
    organizationMemberships: { id: {}, userId: {}, organizationId: {}, status: {} },
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  };
});

// ── Import after mocks ────────────────────────────────────────────────────────
import { getServerFeatureFlag } from '@/lib/analytics/flags';
import { getCurrentUser } from '@/lib/auth/user';
import { createDocumentUploadTarget } from '@/lib/documents/service';
import { env } from '@/lib/env';
import { getOrganizationBySlug } from '@/lib/orgs/service';
import { db } from '@ai-workspace-lab/db';
import type { NextRequest } from 'next/server';

import { POST } from './route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const ORG_SLUG = 'test-org';

function makeRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/orgs/test-org/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const PARAMS = Promise.resolve({ orgSlug: ORG_SLUG });
const MOCK_USER = {
  id: USER_ID,
  email: 'test@example.com',
  status: 'active' as const,
  authProvider: 'google',
  authProviderUserId: 'google-123',
  displayName: null,
  avatarUrl: null,
  timezone: null,
  lastSeenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};
const MOCK_ORG = {
  id: ORG_ID,
  slug: ORG_SLUG,
  name: 'Test Org',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ownerUserId: USER_ID,
  metadata: null,
};
const MOCK_MEMBERSHIP = { id: 'membership-1' };
const MOCK_DOCUMENT = {
  id: 'doc-1',
  status: 'uploaded' as const,
  sourceType: 'web_upload' as const,
  organizationId: ORG_ID,
  storageObjectId: 'storage-1',
  createdByUserId: USER_ID,
  title: 'report.pdf',
  fileType: 'application/pdf',
  processingErrorCode: null,
  processingErrorMessage: null,
  pageCount: null,
  language: null,
  checksumSha256: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  readyAt: null,
};
const MOCK_RESULT = {
  document: MOCK_DOCUMENT,
  uploadUrl: 'https://r2.example.com/presigned',
};

function setupHappyPath() {
  vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER);
  vi.mocked(getOrganizationBySlug).mockResolvedValue(MOCK_ORG);
  const limitMock = vi.fn().mockResolvedValue([MOCK_MEMBERSHIP]);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  vi.mocked(db.select).mockReturnValue({ from: fromMock } as never);
  vi.mocked(createDocumentUploadTarget).mockResolvedValue(MOCK_RESULT);
}

describe('POST /api/orgs/[orgSlug]/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    (env as { NEXT_PUBLIC_POSTHOG_KEY: string | undefined }).NEXT_PUBLIC_POSTHOG_KEY = undefined;
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'not-json',
    }) as unknown as NextRequest;
    const res = await POST(req, { params: PARAMS });
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest({ filename: 'report.pdf' }), { params: PARAMS });
    expect(res.status).toBe(400);
  });

  it('returns 400 when byteSize is zero or negative', async () => {
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 0 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when org is not found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER);
    vi.mocked(getOrganizationBySlug).mockResolvedValue(null);
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when org exists but is not active', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER);
    const suspendedOrg = { ...MOCK_ORG, status: 'suspended' as const };
    vi.mocked(getOrganizationBySlug).mockResolvedValue(suspendedOrg);
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not a member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER);
    vi.mocked(getOrganizationBySlug).mockResolvedValue(MOCK_ORG);
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as never);
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when PostHog is configured and feature flag is off', async () => {
    (env as { NEXT_PUBLIC_POSTHOG_KEY: string | undefined }).NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    setupHappyPath();
    vi.mocked(getServerFeatureFlag).mockResolvedValue(false);
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(403);
    // reset handled by afterEach
  });

  it('skips feature flag check when PostHog key is absent', async () => {
    setupHappyPath();
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(200);
    expect(getServerFeatureFlag).not.toHaveBeenCalled();
  });

  it('returns 402 when EntitlementError(FEATURE_NOT_INCLUDED)', async () => {
    setupHappyPath();
    const { EntitlementError } = await import('@ai-workspace-lab/entitlements');
    vi.mocked(createDocumentUploadTarget).mockRejectedValue(
      new EntitlementError('FEATURE_NOT_INCLUDED'),
    );
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(402);
  });

  it('returns 402 with billing message when EntitlementError(NO_ACTIVE_SUBSCRIPTION)', async () => {
    setupHappyPath();
    const { EntitlementError } = await import('@ai-workspace-lab/entitlements');
    vi.mocked(createDocumentUploadTarget).mockRejectedValue(
      new EntitlementError('NO_ACTIVE_SUBSCRIPTION'),
    );
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/subscription/i);
  });

  it('returns 429 when EntitlementError(QUOTA_EXCEEDED)', async () => {
    setupHappyPath();
    const { EntitlementError } = await import('@ai-workspace-lab/entitlements');
    vi.mocked(createDocumentUploadTarget).mockRejectedValue(new EntitlementError('QUOTA_EXCEEDED'));
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(429);
  });

  it('returns 400 when StorageError(INVALID_FILE_TYPE)', async () => {
    setupHappyPath();
    const { StorageError } = await import('@ai-workspace-lab/storage');
    vi.mocked(createDocumentUploadTarget).mockRejectedValue(
      new StorageError('INVALID_FILE_TYPE', 'Not allowed'),
    );
    const res = await POST(
      makeRequest({ filename: 'photo.jpg', contentType: 'image/jpeg', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when StorageError(FILE_TOO_LARGE)', async () => {
    setupHappyPath();
    const { StorageError } = await import('@ai-workspace-lab/storage');
    vi.mocked(createDocumentUploadTarget).mockRejectedValue(
      new StorageError('FILE_TOO_LARGE', 'Too big'),
    );
    const res = await POST(
      makeRequest({ filename: 'huge.pdf', contentType: 'application/pdf', byteSize: 999_999_999 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with document and uploadUrl on success', async () => {
    setupHappyPath();
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { document: { id: string }; uploadUrl: string };
    expect(body.document.id).toBe('doc-1');
    expect(body.uploadUrl).toBe('https://r2.example.com/presigned');
  });

  it('calls createDocumentUploadTarget with correct inputs', async () => {
    setupHappyPath();
    await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 2048 }),
      { params: PARAMS },
    );
    expect(createDocumentUploadTarget).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      userId: USER_ID,
      filename: 'report.pdf',
      contentType: 'application/pdf',
      byteSize: 2048,
    });
  });

  it('returns 402 when StorageError(NOT_AUTHORIZED)', async () => {
    setupHappyPath();
    const { StorageError } = await import('@ai-workspace-lab/storage');
    vi.mocked(createDocumentUploadTarget).mockRejectedValue(
      new StorageError('NOT_AUTHORIZED', 'Org membership check failed'),
    );
    const res = await POST(
      makeRequest({ filename: 'report.pdf', contentType: 'application/pdf', byteSize: 1024 }),
      { params: PARAMS },
    );
    expect(res.status).toBe(402);
  });
});
