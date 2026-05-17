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

import { downloadObject } from '@ai-workspace-lab/storage';
import { chunkText, extractText, processDocumentHandler } from './process-document';

// ── Helper: create a mock Drizzle-compatible Database ────────────────────────

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

// ── chunkText ────────────────────────────────────────────────────────────────

describe('chunkText', () => {
  it('combines short paragraphs into one chunk', () => {
    const chunks = chunkText('Para one.\n\nPara two.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Para one');
    expect(chunks[0]).toContain('Para two');
  });

  it('splits long single paragraph by sentences', () => {
    // Each sentence is ~100 chars; 20 sentences = ~2000 chars, exceeds 1500 limit
    const many = Array.from(
      { length: 20 },
      (_, i) =>
        `Sentence ${i + 1} is deliberately padded with extra words to push it well past one hundred characters in total length.`,
    ).join(' ');
    const chunks = chunkText(many);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1500);
  });

  it('truncates a sentence that exceeds max chars', () => {
    const chunks = chunkText('A'.repeat(2000));
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1500);
  });

  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   \n\n   ')).toEqual([]);
  });

  it('filters out empty chunks', () => {
    const chunks = chunkText('\n\n\n\nActual content.\n\n\n\n');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Actual content.');
  });

  it('starts a new chunk when adding paragraph would exceed 1500 chars', () => {
    const big = 'A'.repeat(1400);
    const small = 'B'.repeat(100);
    const chunks = chunkText(`${big}\n\n${small}`);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
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

    // Verify org-scoped chunk rows include the correct organizationId
    const insertChain = vi.mocked(mockDb.insert).mock.results[0]?.value as {
      values: ReturnType<typeof vi.fn>;
    };
    const chunkRows = insertChain.values.mock.calls[0]?.[0] as Array<{ organizationId: string }>;
    expect(chunkRows.every((row) => row.organizationId === ORG_ID)).toBe(true);
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

    // update called once to set processing, once to set failed
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
    // delete must happen before insert
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
