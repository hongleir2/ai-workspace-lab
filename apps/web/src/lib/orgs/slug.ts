const SLUG_FORMAT = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export class OrgSlugConflictError extends Error {
  override readonly name = 'OrgSlugConflictError';

  constructor(message = 'Organization slug is already taken') {
    super(message);
  }
}

export class OrgSlugInvalidError extends Error {
  override readonly name = 'OrgSlugInvalidError';

  constructor(message = 'Invalid organization slug format') {
    super(message);
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function assertValidSlug(candidate: string): void {
  if (!SLUG_FORMAT.test(candidate)) {
    throw new OrgSlugInvalidError();
  }
}

function candidateSlug(base: string, attemptIndex: number): string {
  if (attemptIndex === 0) {
    return base;
  }
  const suffix = `-${attemptIndex + 1}`;
  if (base.length + suffix.length > 40) {
    throw new OrgSlugInvalidError(
      'Organization name is too long to generate a unique slug — please choose a shorter name',
    );
  }
  return `${base}${suffix}`;
}

export async function generateUniqueSlug(
  name: string,
  isSlugTaken: (slug: string) => Promise<boolean>,
  slugOverride?: string,
  maxAttempts = 5,
): Promise<string> {
  const normalizedOverride = slugOverride?.trim().toLowerCase();
  if (normalizedOverride !== undefined && normalizedOverride.length > 0) {
    assertValidSlug(normalizedOverride);
    if (await isSlugTaken(normalizedOverride)) {
      throw new OrgSlugConflictError();
    }
    return normalizedOverride;
  }

  const baseRaw = slugify(name);
  if (baseRaw.length < 3) {
    throw new OrgSlugInvalidError('Organization name must yield a slug at least 3 characters long');
  }

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = candidateSlug(baseRaw, i);
    if (candidate.length < 3) {
      continue;
    }
    assertValidSlug(candidate);
    if (!(await isSlugTaken(candidate))) {
      return candidate;
    }
  }

  throw new OrgSlugConflictError();
}
