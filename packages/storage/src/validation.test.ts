import { describe, expect, it } from 'vitest';
import { StorageError } from './errors';
import { validateFileSize, validateFileType } from './validation';

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
