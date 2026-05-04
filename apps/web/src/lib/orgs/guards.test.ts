/**
 * Guards call `redirect()` from next/navigation. We emulate Next's throwing behavior.
 */

import type { Organization, OrganizationMembership, User } from '@ai-workspace-lab/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, limitFn } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
  },
  limitFn: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/auth/user', () => ({
  requireUser: vi.fn(),
}));

vi.mock('@/lib/orgs/service', () => ({
  getOrganizationBySlug: vi.fn(),
}));

vi.mock('@ai-workspace-lab/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-workspace-lab/db')>();
  return {
    ...actual,
    db: mockDb,
  };
});

await import('next/navigation');

import { requireUser } from '@/lib/auth/user';
import { requireMembership, requireOrganizationBySlug, requireRole } from '@/lib/orgs/guards';
import { getOrganizationBySlug } from '@/lib/orgs/service';

const mockRequireUser = vi.mocked(requireUser);
const mockGetOrgSlug = vi.mocked(getOrganizationBySlug);

function wireMembershipSelect(limitResult: OrganizationMembership[]) {
  limitFn.mockReset();
  limitFn.mockResolvedValue(limitResult);

  mockDb.select.mockReset();
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: limitFn,
      }),
    }),
  });
}

function baseUser(): User {
  return {
    id: 'u1',
    email: 'user@example.com',
    authProvider: 'supabase',
    authProviderUserId: 'x',
    displayName: null,
    avatarUrl: null,
    timezone: null,
    status: 'active',
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function baseOrganization(ownerUserId: string): Organization {
  return {
    id: 'o1',
    slug: 'team',
    name: 'Team',
    ownerUserId,
    status: 'active',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function activeMembership(role: OrganizationMembership['role']): OrganizationMembership {
  return {
    id: 'm1',
    organizationId: 'o1',
    userId: 'u1',
    role,
    status: 'active',
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('requireOrganizationBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /app when the organization is unknown', async () => {
    mockGetOrgSlug.mockResolvedValue(null);
    await expect(requireOrganizationBySlug('missing')).rejects.toThrow('REDIRECT:/app');
  });

  it('returns the organization row when present', async () => {
    const organization = { id: 'o1', slug: 'ok' } as Organization;
    mockGetOrgSlug.mockResolvedValue(organization);
    await expect(requireOrganizationBySlug('ok')).resolves.toBe(organization);
  });
});

describe('requireMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects when there is no active membership row', async () => {
    wireMembershipSelect([]);
    const user = baseUser();
    const organization = baseOrganization('u1');

    mockRequireUser.mockResolvedValue(user);
    mockGetOrgSlug.mockResolvedValue(organization);

    await expect(requireMembership('team')).rejects.toThrow('REDIRECT:/app');
    expect(limitFn).toHaveBeenCalledWith(1);
  });

  it('returns context when membership is active', async () => {
    const user = baseUser();
    const organization = baseOrganization('u2');
    const membership = activeMembership('owner');

    mockRequireUser.mockResolvedValue(user);
    mockGetOrgSlug.mockResolvedValue(organization);

    wireMembershipSelect([membership]);

    await expect(requireMembership('team')).resolves.toEqual({
      user,
      organization,
      membership,
    });
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue(baseUser());
    mockGetOrgSlug.mockResolvedValue(baseOrganization('u2'));
  });

  it('redirects with insufficient_role when role is excluded', async () => {
    wireMembershipSelect([activeMembership('member')]);
    await expect(requireRole('team', ['owner'])).rejects.toThrow(
      'REDIRECT:/app/team?error=insufficient_role',
    );
  });

  it('returns context when role is permitted', async () => {
    const membership = activeMembership('owner');

    wireMembershipSelect([membership]);

    await expect(requireRole('team', ['owner'])).resolves.toMatchObject({
      membership,
    });
  });
});
