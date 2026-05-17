import {
  EntitlementError,
  getOrganizationPlan,
  getPlanLimits,
} from '@ai-workspace-lab/entitlements';
import { describe, expect, it, vi } from 'vitest';
import { StorageError } from './errors';
import {
  DEFAULT_MAX_FILE_SIZE_MB,
  getMaxFileSizeMb,
  validateFileSize,
  validateFileType,
} from './validation';

vi.mock('@ai-workspace-lab/entitlements', () => ({
  EntitlementError: class EntitlementError extends Error {
    constructor(public code: string) {
      super(code);
      this.name = 'EntitlementError';
    }
  },
  getOrganizationPlan: vi.fn(),
  getPlanLimits: vi.fn(),
}));

const MB = 1024 * 1024;

describe('validateFileType', () => {
  it.each([
    ['report.pdf', 'application/pdf'],
    ['notes.txt', 'text/plain'],
    ['README.md', 'text/markdown'],
  ])('accepts %s with correct MIME', (name, contentType) => {
    expect(() => validateFileType(name, contentType)).not.toThrow();
  });

  it('accepts uppercase extensions (case-insensitive)', () => {
    expect(() => validateFileType('REPORT.PDF', 'application/pdf')).not.toThrow();
    expect(() => validateFileType('NOTES.TXT', 'text/plain')).not.toThrow();
  });

  it.each(['photo.jpg', 'archive.zip', 'doc.docx', 'script.js', 'Makefile'])(
    'rejects %s (invalid extension)',
    (name) => {
      let caught: unknown;
      try {
        validateFileType(name, 'application/octet-stream');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(StorageError);
      expect((caught as StorageError).code).toBe('INVALID_FILE_TYPE');
    },
  );

  describe('MIME mismatch', () => {
    it('rejects pdf filename with wrong MIME type', () => {
      let caught: unknown;
      try {
        validateFileType('report.pdf', 'application/octet-stream');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(StorageError);
      expect((caught as StorageError).code).toBe('INVALID_FILE_TYPE');
    });

    it('accepts md with text/plain (some clients send this)', () => {
      expect(() => validateFileType('README.md', 'text/plain')).not.toThrow();
    });
  });
});

describe('getMaxFileSizeMb', () => {
  const mockPlan = { subscription: { planId: 'plan-1', id: 'sub-1' } };

  it('returns limitValue from plan limits', async () => {
    vi.mocked(getOrganizationPlan).mockResolvedValue(mockPlan as never);
    vi.mocked(getPlanLimits).mockResolvedValue([{ limitValue: 50 }] as never);
    const result = await getMaxFileSizeMb('org-1');
    expect(result).toBe(50);
  });

  it('returns Infinity when limitValue is null (unlimited plan)', async () => {
    vi.mocked(getOrganizationPlan).mockResolvedValue(mockPlan as never);
    vi.mocked(getPlanLimits).mockResolvedValue([{ limitValue: null }] as never);
    const result = await getMaxFileSizeMb('org-1');
    expect(result).toBe(Number.POSITIVE_INFINITY);
  });

  it(`returns DEFAULT_MAX_FILE_SIZE_MB (${DEFAULT_MAX_FILE_SIZE_MB}) when no plan_limits row exists`, async () => {
    vi.mocked(getOrganizationPlan).mockResolvedValue(mockPlan as never);
    vi.mocked(getPlanLimits).mockResolvedValue([] as never);
    const result = await getMaxFileSizeMb('org-1');
    expect(result).toBe(DEFAULT_MAX_FILE_SIZE_MB);
  });

  it('throws StorageError NOT_AUTHORIZED when org has no active subscription', async () => {
    vi.mocked(getOrganizationPlan).mockRejectedValue(
      new EntitlementError('NO_ACTIVE_SUBSCRIPTION'),
    );
    let caught: unknown;
    try {
      await getMaxFileSizeMb('org-1');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe('NOT_AUTHORIZED');
  });
});

describe('validateFileSize', () => {
  it('accepts file under limit', () => {
    expect(() => validateFileSize(4 * MB, 5)).not.toThrow();
  });

  it('accepts file exactly at limit', () => {
    expect(() => validateFileSize(5 * MB, 5)).not.toThrow();
  });

  it('rejects file 1 byte over limit', () => {
    let caught: unknown;
    try {
      validateFileSize(5 * MB + 1, 5);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageError);
    expect((caught as StorageError).code).toBe('FILE_TOO_LARGE');
  });

  it('rejects file significantly over limit', () => {
    expect(() => validateFileSize(100 * MB, 5)).toThrow(StorageError);
  });
});
