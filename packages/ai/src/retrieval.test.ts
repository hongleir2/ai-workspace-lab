import { describe, expect, it, vi } from 'vitest';
import {
  buildContextBlock,
  embedQuery,
  retrieveRelevantChunks,
  validateRagScope,
} from './retrieval';
import type { RagChunk } from './retrieval';

// Mock @ai-workspace-lab/db
vi.mock('@ai-workspace-lab/db', () => ({
  db: {},
  documentChunks: {
    id: { name: 'id' },
    documentId: { name: 'document_id' },
    chunkIndex: { name: 'chunk_index' },
    text: { name: 'text' },
    sectionTitle: { name: 'section_title' },
    pageStart: { name: 'page_start' },
    pageEnd: { name: 'page_end' },
    embedding: { name: 'embedding' },
    organizationId: { name: 'organization_id' },
  },
  documents: {
    id: { name: 'id' },
    organizationId: { name: 'organization_id' },
    deletedAt: { name: 'deleted_at' },
  },
  and: vi.fn((...args) => args),
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  isNull: vi.fn((col) => ({ type: 'isNull', col })),
  isNotNull: vi.fn((col) => ({ type: 'isNotNull', col })),
  sql: Object.assign(vi.fn(), { raw: vi.fn((s: string) => ({ type: 'raw', value: s })) }),
}));

// Mock 'ai'
vi.mock('ai', () => ({
  embed: vi.fn(),
}));

// Mock '@ai-sdk/openai'
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({
    embedding: vi.fn(() => 'mock-embedding-model'),
  })),
}));

const makeChunk = (overrides: Partial<RagChunk> = {}): RagChunk => ({
  id: 'chunk-1',
  documentId: 'doc-1',
  chunkIndex: 0,
  text: 'Sample text',
  sectionTitle: null,
  pageStart: null,
  pageEnd: null,
  similarity: 0.85,
  ...overrides,
});

describe('buildContextBlock', () => {
  it('returns empty string for empty array', () => {
    expect(buildContextBlock([])).toBe('');
  });

  it('formats single chunk without metadata', () => {
    const chunk = makeChunk({ text: 'Hello world' });
    const result = buildContextBlock([chunk]);
    expect(result).toBe('[1]\nHello world');
  });

  it('includes section title and page number when present', () => {
    const chunk = makeChunk({
      sectionTitle: 'Introduction',
      pageStart: 3,
      pageEnd: 3,
      text: 'Content',
    });
    const result = buildContextBlock([chunk]);
    expect(result).toContain('Section: Introduction');
    expect(result).toContain('Page 3');
  });

  it('includes page range when start and end differ', () => {
    const chunk = makeChunk({ pageStart: 2, pageEnd: 4, text: 'Multi-page' });
    const result = buildContextBlock([chunk]);
    expect(result).toContain('Pages 2–4');
  });

  it('separates multiple chunks with delimiter', () => {
    const chunks = [makeChunk({ text: 'First' }), makeChunk({ id: 'c2', text: 'Second' })];
    const result = buildContextBlock(chunks);
    expect(result).toContain('[1]');
    expect(result).toContain('[2]');
    expect(result).toContain('---');
  });
});

describe('embedQuery', () => {
  it('throws CONFIGURATION_ERROR when apiKey is empty', async () => {
    const { AiError } = await import('./index');
    await expect(embedQuery('test', '')).rejects.toThrow(AiError);
  });

  it('calls embed and returns embedding vector and token count', async () => {
    const { embed } = await import('ai');
    vi.mocked(embed).mockResolvedValueOnce({
      embedding: [0.1, 0.2, 0.3],
      usage: { tokens: 4 },
    } as never);
    const result = await embedQuery('test query', 'sk-test');
    expect(result).toEqual({ embedding: [0.1, 0.2, 0.3], tokens: 4 });
  });
});

describe('validateRagScope', () => {
  it('does not throw when document belongs to org', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'doc-1' }]),
    };
    await expect(validateRagScope('org-1', 'doc-1', mockDb as never)).resolves.toBeUndefined();
  });

  it('throws when document not found in org', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    await expect(validateRagScope('org-1', 'other-doc', mockDb as never)).rejects.toThrow(
      'not found in organization',
    );
  });
});

describe('retrieveRelevantChunks', () => {
  it('maps DB rows to RagChunk objects', async () => {
    const mockRow = {
      id: 'chunk-id',
      document_id: 'doc-id',
      chunk_index: 2,
      text: 'Some text',
      section_title: 'Intro',
      page_start: 1,
      page_end: 2,
      similarity: 0.9,
    };
    const mockDb = { execute: vi.fn().mockResolvedValue([mockRow]) };
    const result = await retrieveRelevantChunks('org-1', [0.1, 0.2], {}, mockDb as never);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'chunk-id',
      documentId: 'doc-id',
      chunkIndex: 2,
      text: 'Some text',
      sectionTitle: 'Intro',
      pageStart: 1,
      pageEnd: 2,
      similarity: 0.9,
    });
  });

  it('filters by organization_id in the query', async () => {
    const mockDb = { execute: vi.fn().mockResolvedValue([]) };
    await retrieveRelevantChunks('org-999', [0.1, 0.2], {}, mockDb as never);
    // sql tagged template: sql`...${orgId}...` calls sql(strings, orgId, ...).
    // Inspect mocked sql function calls to verify org-id was interpolated as a value.
    const { sql } = await import('@ai-workspace-lab/db');
    const allValues = vi.mocked(sql).mock.calls.flatMap(([, ...vals]) => vals);
    expect(allValues).toContain('org-999');
  });

  it('throws PROVIDER_ERROR for non-finite embedding values', async () => {
    const mockDb = { execute: vi.fn() };
    const { AiError } = await import('./index');
    await expect(
      retrieveRelevantChunks('org-1', [0.1, Number.NaN, 0.3], {}, mockDb as never),
    ).rejects.toThrow(AiError);
  });

  it('returns empty array when no chunks match', async () => {
    const mockDb = { execute: vi.fn().mockResolvedValue([]) };
    const result = await retrieveRelevantChunks('org-1', [0.1, 0.2], {}, mockDb as never);
    expect(result).toEqual([]);
  });
});
