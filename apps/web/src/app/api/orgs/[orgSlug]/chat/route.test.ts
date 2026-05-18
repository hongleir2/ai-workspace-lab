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
  getServerFeatureFlag: vi.fn().mockResolvedValue(true),
  FLAGS: {
    DOCUMENT_UPLOAD: 'document_upload_enabled',
    AI_CHAT: 'ai_chat_enabled',
    RAG_V1: 'rag_v1_enabled',
    DESKTOP_UPLOAD: 'desktop_upload_enabled',
    REALTIME_STATUS: 'realtime_status_enabled',
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_POSTHOG_KEY: undefined,
    OPENAI_API_KEY: 'sk-test-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_MAX_TOKENS: 4096,
  },
}));

vi.mock('@/lib/ai/rate-limit', () => ({
  checkAiRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, reset: 0 }),
}));

vi.mock('@ai-workspace-lab/ai', () => ({
  EMBEDDING_MODEL: 'text-embedding-3-small',
  streamChatCompletion: vi.fn(),
  buildPromptFromMessages: vi.fn((messages: unknown[]) => messages),
  normalizeTokenUsage: vi.fn(
    (
      usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    ) => ({
      inputTokens: usage?.promptTokens ?? 0,
      outputTokens: usage?.completionTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    }),
  ),
  estimateCost: vi.fn(() => 123),
  embedQuery: vi.fn(),
  retrieveRelevantChunks: vi.fn().mockResolvedValue([]),
  buildContextBlock: vi.fn((chunks: unknown[]) =>
    chunks.map((_, i) => `[${i + 1}] chunk text`).join('\n'),
  ),
  validateRagScope: vi.fn(),
  AiError: class AiError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'AiError';
      this.code = code;
    }
  },
}));

vi.mock('@ai-workspace-lab/entitlements', () => ({
  assertFeatureAllowed: vi.fn(),
  getOrganizationPlan: vi.fn(),
  getPlanLimits: vi.fn(),
  getCurrentBillingPeriod: vi.fn(),
  EntitlementError: class EntitlementError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'EntitlementError';
      this.code = code;
    }
  },
  FEATURE_KEYS: { AI_MESSAGES: 'ai_messages' },
}));

vi.mock('@ai-workspace-lab/usage', () => ({
  recordUsageWithCounter: vi.fn(),
}));

vi.mock('@ai-workspace-lab/db', () => {
  const select = vi.fn();
  const insert = vi.fn();
  return {
    db: { select, insert },
    organizationMemberships: { id: {}, userId: {}, organizationId: {}, status: {} },
    aiSessions: { id: {}, organizationId: {}, createdByUserId: {}, status: {}, deletedAt: {} },
    aiMessages: {},
    aiMessageSources: {},
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
    isNull: vi.fn((value: unknown) => ({ isNull: value })),
  };
});

// ── Import after mocks ────────────────────────────────────────────────────────

import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import { getServerFeatureFlag } from '@/lib/analytics/flags';
import { getCurrentUser } from '@/lib/auth/user';
import { env } from '@/lib/env';
import { getOrganizationBySlug } from '@/lib/orgs/service';
import {
  AiError,
  buildContextBlock,
  buildPromptFromMessages,
  embedQuery,
  estimateCost,
  normalizeTokenUsage,
  retrieveRelevantChunks,
  streamChatCompletion,
  validateRagScope,
} from '@ai-workspace-lab/ai';
import { db } from '@ai-workspace-lab/db';
import {
  EntitlementError,
  assertFeatureAllowed,
  getCurrentBillingPeriod,
  getOrganizationPlan,
  getPlanLimits,
} from '@ai-workspace-lab/entitlements';
import { recordUsageWithCounter } from '@ai-workspace-lab/usage';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { POST } from './route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const SESSION_ID = '00000000-0000-0000-0000-000000000003';
const ORG_SLUG = 'test-org';
const USER_MESSAGE_ID = '00000000-0000-0000-0000-000000000004';
const ASSISTANT_MESSAGE_ID = '00000000-0000-0000-0000-000000000005';

const MOCK_PERIOD = {
  start: new Date('2026-05-01T00:00:00.000Z'),
  end: new Date('2026-05-31T23:59:59.999Z'),
};

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
const MOCK_SESSION = { id: SESSION_ID };

let selectQueue: unknown[][] = [];
let userInsertState: { values: ReturnType<typeof vi.fn> } | null = null;
let assistantInsertState: { values: ReturnType<typeof vi.fn> } | null = null;
let sourcesInsertState: { values: ReturnType<typeof vi.fn> } | null = null;
let capturedOnFinish:
  | ((result: {
      text: string;
      usage: { promptTokens: number; completionTokens: number; totalTokens: number };
      finishReason: string;
    }) => Promise<void> | void)
  | undefined;

const DOC_ID = '00000000-0000-0000-0000-000000000006';

function makeRequest(
  body: unknown = {
    messages: [{ role: 'user', content: 'Hello there' }],
    sessionId: SESSION_ID,
  },
): NextRequest {
  return new Request(`http://localhost/api/orgs/${ORG_SLUG}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const MOCK_RAG_CHUNK = {
  id: 'chunk-1',
  documentId: DOC_ID,
  chunkIndex: 0,
  text: 'Relevant chunk text.',
  sectionTitle: null,
  pageStart: null,
  pageEnd: null,
  similarity: 0.85,
};

function makeInsertState(row: { id: string }) {
  const returning = vi.fn().mockResolvedValue([row]);
  const values = vi.fn().mockReturnValue({ returning });
  return { values };
}

function setupSelectQueue(...rows: unknown[][]) {
  selectQueue = [...rows];
}

function setupHappyPath() {
  vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER);
  vi.mocked(getOrganizationBySlug).mockResolvedValue(MOCK_ORG);
  vi.mocked(getServerFeatureFlag).mockResolvedValue(true);
  vi.mocked(assertFeatureAllowed).mockResolvedValue(undefined);
  vi.mocked(getOrganizationPlan).mockResolvedValue({
    plan: { id: 'pro', name: 'Pro' },
    subscription: {
      id: 'sub-1',
      organizationId: ORG_ID,
      planId: 'pro',
      billingCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      status: 'active' as const,
      seats: 1,
      currentPeriodStart: MOCK_PERIOD.start,
      currentPeriodEnd: MOCK_PERIOD.end,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      endedAt: null,
      trialEnd: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as never);
  vi.mocked(getPlanLimits).mockResolvedValue([
    { resetInterval: 'month', limitValue: 100 },
  ] as never);
  vi.mocked(getCurrentBillingPeriod).mockReturnValue(MOCK_PERIOD as never);
  vi.mocked(recordUsageWithCounter).mockResolvedValue({ inserted: true, event: {} as never });
  vi.mocked(buildPromptFromMessages).mockImplementation((messages) => messages);
  vi.mocked(normalizeTokenUsage).mockImplementation(
    (
      usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    ) => ({
      inputTokens: usage?.promptTokens ?? 0,
      outputTokens: usage?.completionTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    }),
  );
  vi.mocked(estimateCost).mockReturnValue(123);
  vi.mocked(checkAiRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 29,
    reset: 0,
  });

  setupSelectQueue([MOCK_MEMBERSHIP], [MOCK_SESSION]);
  userInsertState = makeInsertState({ id: USER_MESSAGE_ID });
  assistantInsertState = makeInsertState({ id: ASSISTANT_MESSAGE_ID });
  sourcesInsertState = { values: vi.fn().mockResolvedValue([]) };

  vi.mocked(db.select).mockImplementation(() => {
    const rows = selectQueue.shift() ?? [];
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    return { from } as never;
  });

  vi.mocked(db.insert)
    .mockImplementationOnce(() => userInsertState as never)
    .mockImplementationOnce(() => assistantInsertState as never)
    .mockImplementation(() => sourcesInsertState as never);

  vi.mocked(validateRagScope).mockResolvedValue(undefined);
  vi.mocked(embedQuery).mockResolvedValue({ embedding: [0.1, 0.2, 0.3], tokens: 3 } as never);
  vi.mocked(retrieveRelevantChunks).mockResolvedValue([]);

  capturedOnFinish = undefined;

  vi.mocked(streamChatCompletion).mockImplementation((input) => {
    capturedOnFinish = input.onFinish as typeof capturedOnFinish;
    return {
      toDataStreamResponse: () => new Response('stream', { status: 200 }),
    } as never;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/orgs/[orgSlug]/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(new Headers());
    vi.mocked(checkAiRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 29,
      reset: 0,
    });
    setupHappyPath();
  });

  afterEach(() => {
    (env as { NEXT_PUBLIC_POSTHOG_KEY: string | undefined }).NEXT_PUBLIC_POSTHOG_KEY = undefined;
    vi.restoreAllMocks();
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'not-json',
    }) as unknown as NextRequest;
    const res = await POST(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest({ sessionId: SESSION_ID }), {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when org is not found', async () => {
    vi.mocked(getOrganizationBySlug).mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not a member', async () => {
    setupSelectQueue([], []);
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(403);
  });

  it('returns 403 when PostHog is configured and the feature flag is off', async () => {
    (env as { NEXT_PUBLIC_POSTHOG_KEY: string | undefined }).NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    vi.mocked(getServerFeatureFlag).mockResolvedValue(false);
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(403);
    expect(getServerFeatureFlag).toHaveBeenCalledWith('ai_chat_enabled', USER_ID);
  });

  it('skips the feature flag check when PostHog is absent', async () => {
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(200);
    expect(getServerFeatureFlag).not.toHaveBeenCalled();
  });

  it('returns 429 when quota is exceeded', async () => {
    vi.mocked(assertFeatureAllowed).mockRejectedValue(new EntitlementError('QUOTA_EXCEEDED'));
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(429);
  });

  it('returns 402 when the feature is not included in the plan', async () => {
    vi.mocked(assertFeatureAllowed).mockRejectedValue(new EntitlementError('FEATURE_NOT_INCLUDED'));
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(402);
  });

  it('returns 429 when the rate limit is hit', async () => {
    vi.mocked(checkAiRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      reset: 60_000,
    });
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(429);
  });

  it('returns 404 when the session is missing', async () => {
    setupSelectQueue([MOCK_MEMBERSHIP], []);
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on the happy path', async () => {
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(200);
    expect(streamChatCompletion).toHaveBeenCalledOnce();
    expect(buildPromptFromMessages).toHaveBeenCalledWith([
      { role: 'user', content: 'Hello there' },
    ]);
  });

  it('calls assertFeatureAllowed before streaming', async () => {
    await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    const assertOrder = vi.mocked(assertFeatureAllowed).mock.invocationCallOrder[0] ?? 0;
    const streamOrder = vi.mocked(streamChatCompletion).mock.invocationCallOrder[0] ?? 999;
    expect(assertOrder).toBeLessThan(streamOrder);
  });

  it('records usage and stores the assistant message in onFinish', async () => {
    await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(capturedOnFinish).toBeDefined();
    await capturedOnFinish?.({
      text: 'Hello back',
      usage: { promptTokens: 11, completionTokens: 22, totalTokens: 33 },
      finishReason: 'stop',
    });

    expect(recordUsageWithCounter).toHaveBeenCalledOnce();
    expect(recordUsageWithCounter).toHaveBeenCalledWith({
      event: expect.objectContaining({
        organizationId: ORG_ID,
        userId: USER_ID,
        featureKey: 'ai_messages',
        eventType: 'ai_message',
        quantity: '1',
        unit: 'count',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        inputTokens: 11,
        outputTokens: 22,
        totalTokens: 33,
        costMicroUsd: 123,
        sourceType: 'ai_message',
        sourceId: USER_MESSAGE_ID,
        idempotencyKey: USER_MESSAGE_ID,
      }),
      period: MOCK_PERIOD,
      limitQuantity: '100',
    });

    expect(assistantInsertState?.values).toHaveBeenCalledOnce();
    expect(assistantInsertState?.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        sessionId: SESSION_ID,
        role: 'assistant',
        content: 'Hello back',
        status: 'completed',
        modelProvider: 'openai',
        modelName: 'gpt-4o-mini',
        inputTokens: 11,
        outputTokens: 22,
        totalTokens: 33,
        costMicroUsd: 123,
      }),
    );
  });

  it('returns 503 when the AI service is not configured', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(() => {
      throw new AiError('missing config', 'CONFIGURATION_ERROR');
    });
    const res = await POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) });
    expect(res.status).toBe(503);
  });

  it('returns 400 when the last message is from the assistant', async () => {
    const res = await POST(
      makeRequest({
        messages: [{ role: 'assistant', content: 'Hi' }],
        sessionId: SESSION_ID,
      }),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when documentId is provided but validateRagScope throws', async () => {
    vi.mocked(validateRagScope).mockRejectedValue(new Error('not found'));
    const res = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        sessionId: SESSION_ID,
        documentId: DOC_ID,
      }),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );
    expect(res.status).toBe(404);
  });

  it('skips system prompt when no chunks are retrieved', async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue([]);
    await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        sessionId: SESSION_ID,
        documentId: DOC_ID,
      }),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );
    const callArgs = vi.mocked(streamChatCompletion).mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect((callArgs as unknown as Record<string, unknown>)['system']).toBeUndefined();
  });

  it('injects system prompt when chunks are retrieved', async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue([MOCK_RAG_CHUNK]);
    vi.mocked(buildContextBlock).mockReturnValue('[1]\nRelevant chunk text.');
    await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        sessionId: SESSION_ID,
        documentId: DOC_ID,
      }),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );
    const callArgs = vi.mocked(streamChatCompletion).mock.calls[0]?.[0];
    expect(typeof (callArgs as unknown as Record<string, unknown>)['system']).toBe('string');
    expect((callArgs as unknown as Record<string, unknown>)['system'] as string).toContain('[1]');
  });

  it('inserts ai_message_sources rows in onFinish when chunks are present', async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue([MOCK_RAG_CHUNK]);
    await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        sessionId: SESSION_ID,
        documentId: DOC_ID,
      }),
      { params: Promise.resolve({ orgSlug: ORG_SLUG }) },
    );
    expect(capturedOnFinish).toBeDefined();
    await capturedOnFinish?.({
      text: 'Answer',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: 'stop',
    });
    // insert called: user message, assistant message, sources
    expect(db.insert).toHaveBeenCalledTimes(3);
    expect(sourcesInsertState?.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          organizationId: ORG_ID,
          aiMessageId: ASSISTANT_MESSAGE_ID,
          documentId: DOC_ID,
          documentChunkId: 'chunk-1',
          citationLabel: '[1]',
        }),
      ]),
    );
  });

  it('throws when user message insert returns no row', async () => {
    setupSelectQueue([MOCK_MEMBERSHIP], [MOCK_SESSION]);
    // Reset insert to clear setupHappyPath's queue, then return empty array
    vi.mocked(db.insert).mockReset();
    const returning = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ returning });
    vi.mocked(db.insert).mockImplementation(() => ({ values }) as never);

    await expect(
      POST(makeRequest(), { params: Promise.resolve({ orgSlug: ORG_SLUG }) }),
    ).rejects.toThrow('Failed to create chat user message');
  });
});
