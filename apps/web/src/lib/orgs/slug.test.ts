import { describe, expect, it, vi } from 'vitest';
import { OrgSlugConflictError, OrgSlugInvalidError, generateUniqueSlug } from './slug.js';

describe('generateUniqueSlug', () => {
  it('accepts available auto-generated slug', async () => {
    const slug = await generateUniqueSlug(
      'Hello World',
      vi.fn(async () => false),
    );
    expect(slug).toBe('hello-world');
  });

  it('retries numeric suffix before settling', async () => {
    const taken = vi.fn(async (s: string) => s === 'foo' || s === 'foo-2');
    const slug = await generateUniqueSlug('Foo!', taken);
    expect(slug).toBe('foo-3');
  });

  it('throws OrgSlugConflictError when all attempts collide', async () => {
    const taken = vi.fn(async () => true);
    await expect(generateUniqueSlug('Acme Industries', taken)).rejects.toBeInstanceOf(
      OrgSlugConflictError,
    );
  });

  it('throws OrgSlugInvalidError when base slug is too long to fit a suffix', async () => {
    // 40 'a's → slugifies to 40-char base; suffix '-2' cannot fit without truncation
    const taken = vi.fn(async () => true);
    await expect(generateUniqueSlug('a'.repeat(40), taken)).rejects.toBeInstanceOf(
      OrgSlugInvalidError,
    );
  });
});
