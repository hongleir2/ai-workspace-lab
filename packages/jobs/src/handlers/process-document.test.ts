import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ai-workspace-lab/db', () => ({
  db: {},
  documents: {},
  documentChunks: {},
  storageObjects: {},
  eq: vi.fn().mockReturnValue({}),
  and: vi.fn().mockReturnValue({}),
  isNull: vi.fn().mockReturnValue({}),
}));

vi.mock('@ai-workspace-lab/storage', () => ({
  downloadObject: vi.fn(),
}));

// tiktoken uses WASM — replace with a deterministic char-based stub.
// 1 char ≈ 1 token so token budgets map directly to character counts in tests.
// decode returns 'x' bytes per token so hard-split slices are non-empty;
// overlap text is 'xxx...' but tests use overlapTokens:0 so it stays "".
// js-tiktoken is pure JS (no WASM). Mock with: 1 char ≈ 1 token, decode returns
// 'x' per token so hard-split slices are non-empty strings.
vi.mock('js-tiktoken', () => ({
  encodingForModel: () => ({
    encode: (text: string) => new Uint32Array(text.length),
    decode: (tokens: Uint32Array) => 'x'.repeat(tokens.length),
  }),
}));

import { downloadObject } from '@ai-workspace-lab/storage';
import {
  CHUNKING_STRATEGY,
  DEFAULT_CHUNK_OPTIONS,
  chunkTextByTokens,
  extractText,
  processDocumentHandler,
} from './process-document';

// ── Helper: create a mock Drizzle-compatible Database ─────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  return { set, where };
}

function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue([]) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue([]) };
}

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
}

const DOC_ID = 'doc-111';
const ORG_ID = 'org-222';
const STORAGE_ID = 'sto-333';
const OBJECT_KEY = 'orgs/org-222/uploads/file.txt';

const MOCK_DOC = {
  id: DOC_ID,
  organizationId: ORG_ID,
  storageObjectId: STORAGE_ID,
  fileType: 'txt',
  status: 'queued' as const,
  deletedAt: null,
};

const MOCK_STORAGE = { id: STORAGE_ID, objectKey: OBJECT_KEY, deletedAt: null };

// ── chunkTextByTokens ─────────────────────────────────────────────────────────
// Token mock: 1 char = 1 token, no overlap (decode → empty string).

describe('chunkTextByTokens', () => {
  const opts = { maxTokens: 20, overlapTokens: 0 };

  it('returns a single chunk for text within budget', () => {
    const chunks = chunkTextByTokens('Short text.', opts);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain('Short text');
  });

  it('returns empty array for empty string', () => {
    expect(chunkTextByTokens('', opts)).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(chunkTextByTokens('   \n\n   ', opts)).toEqual([]);
  });

  it('assigns sequential chunkIndex values', () => {
    // 3 sentences × 10 chars each = 30 chars, budget 20 → at least 2 chunks
    const text = 'Sentence one.\nSentence two.\nSentence three.';
    const chunks = chunkTextByTokens(text, opts);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('every chunk respects maxTokens budget', () => {
    const sentence = 'A'.repeat(15); // 15 chars = 15 tokens under mock
    const text = `${sentence}.\n\n${sentence}.\n\n${sentence}.`;
    const chunks = chunkTextByTokens(text, opts);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(opts.maxTokens);
  });

  it('splits a long paragraph across multiple chunks', () => {
    const long = 'Word '.repeat(30); // 150 chars, well over budget of 20
    const chunks = chunkTextByTokens(long, opts);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(opts.maxTokens);
  });

  it('stores tokenCount on every chunk', () => {
    const chunks = chunkTextByTokens('Hello world.', opts);
    for (const c of chunks) {
      expect(typeof c.tokenCount).toBe('number');
      expect(c.tokenCount).toBeGreaterThan(0);
    }
  });

  it('stores startCharIndex and endCharIndex on every chunk', () => {
    const chunks = chunkTextByTokens('Hello world.', opts);
    for (const c of chunks) {
      expect(typeof c.startCharIndex).toBe('number');
      expect(typeof c.endCharIndex).toBe('number');
      expect(c.endCharIndex).toBeGreaterThanOrEqual(c.startCharIndex);
    }
  });

  it('hard-splits a single oversized sentence at token boundaries', () => {
    // One sentence of 50 chars, budget 20
    const bigSentence = 'A'.repeat(50);
    const chunks = chunkTextByTokens(bigSentence, opts);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(opts.maxTokens);
  });

  it('splits Chinese text on ideographic terminators', () => {
    const sentence = '这是一个测试句子用于验证分句工作。'; // ~17 chars
    const text = sentence.repeat(5); // ~85 chars, budget 20 → multiple chunks
    const chunks = chunkTextByTokens(text, opts);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(opts.maxTokens);
  });

  it('preserves Korean characters through chunking', () => {
    // 。terminator so each sentence goes through normal path (not hard-split),
    // preserving original text in chunk.text via currentSentences
    const korean = '안녕하세요 이것은 테스트입니다。';
    const chunks = chunkTextByTokens(korean.repeat(3), opts);
    expect(chunks.map((c) => c.text).join('')).toContain('안녕하세요');
  });

  it('default options are exported with expected values', () => {
    expect(DEFAULT_CHUNK_OPTIONS.maxTokens).toBe(700);
    expect(DEFAULT_CHUNK_OPTIONS.overlapTokens).toBe(100);
  });

  it('CHUNKING_STRATEGY constant is exported', () => {
    expect(CHUNKING_STRATEGY).toBe('paragraph_sentence_token_v1');
  });
});

// ── extractText ───────────────────────────────────────────────────────────────

describe('extractText', () => {
  it('returns buffer as UTF-8 for txt', async () => {
    const buf = Buffer.from('Hello, world!');
    expect(await extractText(buf, 'txt')).toBe('Hello, world!');
  });

  it('returns buffer as UTF-8 for md', async () => {
    const buf = Buffer.from('# Title\n\nBody.');
    expect(await extractText(buf, 'md')).toBe('# Title\n\nBody.');
  });

  it('throws for unsupported file type', async () => {
    await expect(extractText(Buffer.from('x'), 'docx')).rejects.toThrow(
      'Unsupported file type: docx',
    );
  });
});

// ── processDocumentHandler ────────────────────────────────────────────────────

describe('processDocumentHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildDb(docRows: unknown[], storageRows: unknown[]): MockDb {
    let selectCall = 0;
    const select = vi.fn().mockImplementation(() => {
      selectCall++;
      return makeSelectChain(selectCall === 1 ? docRows : storageRows);
    });
    const update = vi.fn().mockImplementation(() => makeUpdateChain());
    const del = vi.fn().mockImplementation(() => makeDeleteChain());
    const insert = vi.fn().mockImplementation(() => makeInsertChain());
    return { select, update, delete: del, insert };
  }

  it('happy path: processing → ready, chunks inserted with correct organizationId', async () => {
    vi.mocked(downloadObject).mockResolvedValue(Buffer.from('Hello world.'));
    const mockDb = buildDb([MOCK_DOC], [MOCK_STORAGE]);

    await processDocumentHandler({ documentId: DOC_ID }, mockDb as never);

    expect(mockDb.update).toHaveBeenCalledTimes(2);
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);

    const insertChain = vi.mocked(mockDb.insert).mock.results[0]?.value as {
      values: ReturnType<typeof vi.fn>;
    };
    const chunkRows = insertChain.values.mock.calls[0]?.[0] as Array<{
      organizationId: string;
      tokenCount: number;
      chunkingStrategy: string;
    }>;
    expect(chunkRows.every((r) => r.organizationId === ORG_ID)).toBe(true);
    expect(chunkRows.every((r) => typeof r.tokenCount === 'number')).toBe(true);
    expect(chunkRows.every((r) => r.chunkingStrategy === CHUNKING_STRATEGY)).toBe(true);
  });

  it('throws when document is not found', async () => {
    const mockDb = buildDb([], [MOCK_STORAGE]);
    await expect(processDocumentHandler({ documentId: DOC_ID }, mockDb as never)).rejects.toThrow(
      `Document not found or deleted: ${DOC_ID}`,
    );
  });

  it('throws when storage object is not found', async () => {
    const mockDb = buildDb([MOCK_DOC], []);
    await expect(processDocumentHandler({ documentId: DOC_ID }, mockDb as never)).rejects.toThrow(
      `Storage object not found: ${STORAGE_ID}`,
    );
  });

  it('marks document failed and rethrows on download error', async () => {
    vi.mocked(downloadObject).mockRejectedValue(new Error('Network error'));
    const mockDb = buildDb([MOCK_DOC], [MOCK_STORAGE]);

    await expect(processDocumentHandler({ documentId: DOC_ID }, mockDb as never)).rejects.toThrow(
      'Network error',
    );

    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('marks document failed on unsupported file type', async () => {
    const unsupportedDoc = { ...MOCK_DOC, fileType: 'docx' };
    const mockDb = buildDb([unsupportedDoc], [MOCK_STORAGE]);
    vi.mocked(downloadObject).mockResolvedValue(Buffer.from('x'));

    await expect(processDocumentHandler({ documentId: DOC_ID }, mockDb as never)).rejects.toThrow(
      'Unsupported file type',
    );

    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('deletes existing chunks before inserting (idempotency)', async () => {
    vi.mocked(downloadObject).mockResolvedValue(Buffer.from('Content.'));
    const mockDb = buildDb([MOCK_DOC], [MOCK_STORAGE]);

    await processDocumentHandler({ documentId: DOC_ID }, mockDb as never);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const deleteCalls = vi.mocked(mockDb.delete).mock.invocationCallOrder[0] ?? 0;
    const insertCalls = vi.mocked(mockDb.insert).mock.invocationCallOrder[0] ?? 1;
    expect(deleteCalls).toBeLessThan(insertCalls);
  });

  it('skips insert when text is empty but still marks ready', async () => {
    vi.mocked(downloadObject).mockResolvedValue(Buffer.from(''));
    const mockDb = buildDb([MOCK_DOC], [MOCK_STORAGE]);

    await processDocumentHandler({ documentId: DOC_ID }, mockDb as never);

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });
});
