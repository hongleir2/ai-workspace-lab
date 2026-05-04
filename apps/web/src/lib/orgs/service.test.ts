import type { Organization } from '@ai-workspace-lab/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('@ai-workspace-lab/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-workspace-lab/db')>();
  return {
    ...actual,
    db: mockDb,
  };
});

import {
  auditLogs,
  organizationMemberships,
  organizations,
  subscriptions,
} from '@ai-workspace-lab/db';
import { createOrganization, getOrganizationBySlug, getUserOrganizations } from './service.js';
import { OrgSlugConflictError, slugify } from './slug.js';

function makeSlugLookupDb(conn: Pick<typeof mockDb, 'select'>) {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));

  conn.select.mockReturnValue({
    from,
  });

  return { limit, where, from };
}

describe('slugify', () => {
  it('slugifies names with punctuation', () => {
    expect(slugify('Acme Co!')).toBe('acme-co');
  });
});

describe('getOrganizationBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the first matching row when present', async () => {
    const org: Partial<Organization> = {
      id: 'org-id',
      slug: 'test',
      name: 'T',
      ownerUserId: 'u',
      status: 'active',
      deletedAt: null,
    };
    const { limit } = makeSlugLookupDb(mockDb);
    limit.mockResolvedValue([org]);

    const result = await getOrganizationBySlug('test');

    expect(result).toMatchObject(org);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('returns null when no row', async () => {
    const { limit } = makeSlugLookupDb(mockDb);
    limit.mockResolvedValue([]);

    const result = await getOrganizationBySlug('missing');
    expect(result).toBeNull();
  });
});

describe('getUserOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins memberships to organizations with active predicates', async () => {
    const orderBy = vi.fn();

    const where = vi.fn(() => ({
      orderBy,
    }));

    const innerJoin = vi.fn(() => ({
      where,
    }));

    const from = vi.fn(() => ({
      innerJoin,
    }));

    mockDb.select.mockReturnValue({ from });

    innerJoin.mockReturnValue({ where });

    orderBy.mockResolvedValue([
      {
        organization: {
          id: 'o',
          slug: 's',
        },
        membership: {
          id: 'm',
          userId: 'u',
          organizationId: 'o',
          role: 'owner',
          status: 'active',
        },
      },
    ]);

    const rows = await getUserOrganizations('user-uuid');

    expect(rows).toHaveLength(1);
    expect(innerJoin).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
  });
});

describe('createOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs four inserts inside a transaction in order', async () => {
    const { limit } = makeSlugLookupDb(mockDb);
    limit.mockResolvedValue([]);

    const inserts: Array<{
      target:
        | typeof organizations
        | typeof organizationMemberships
        | typeof auditLogs
        | typeof subscriptions;
      values: unknown;
    }> = [];

    const txInsert = vi.fn(
      (
        target:
          | typeof organizations
          | typeof organizationMemberships
          | typeof auditLogs
          | typeof subscriptions,
      ) => ({
        values: (values: unknown) => {
          inserts.push({ target, values });

          const valuesObj = values as Record<string, unknown>;

          if (target === auditLogs || target === subscriptions) {
            return {};
          }

          const row =
            target === organizations
              ? {
                  id: 'org-inserted-id',
                  name: valuesObj['name'],
                  slug: valuesObj['slug'],
                  ownerUserId: valuesObj['ownerUserId'],
                  status: valuesObj['status'],
                  deletedAt: null,
                  metadata: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
              : {
                  id: 'mem-inserted-id',
                  organizationId: valuesObj['organizationId'],
                  userId: valuesObj['userId'],
                  role: valuesObj['role'],
                  status: valuesObj['status'],
                  joinedAt: valuesObj['joinedAt'],
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };

          return {
            returning: async () => [row],
          };
        },
      }),
    );

    mockDb.transaction.mockImplementation(
      async (cb: (tx: { insert: typeof txInsert }) => Promise<unknown>) =>
        cb({
          insert: txInsert,
        }),
    );

    const result = await createOrganization({
      name: '  Acme  ',
      ownerUserId: 'owner-user',
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(result.organization.slug).toBe('acme');
    expect(inserts).toHaveLength(4);

    expect(inserts[0]?.target).toBe(organizations);
    expect(inserts[1]?.target).toBe(organizationMemberships);
    expect(inserts[2]?.target).toBe(auditLogs);
    expect(inserts[3]?.target).toBe(subscriptions);

    const subValues = inserts[3]?.values as Record<string, unknown>;
    expect(subValues['planId']).toBe('free');
    expect(subValues['status']).toBe('free');
    expect(subValues['cancelAtPeriodEnd']).toBe(false);

    const auditValues = inserts[2]?.values as Record<string, unknown>;

    expect(auditValues['action']).toBe('organization.created');
    expect(auditValues['entityType']).toBe('organization');
    expect(auditValues['entityId']).toBe('org-inserted-id');
    expect(auditValues['afterState']).toEqual({ name: 'Acme', slug: 'acme' });
    expect(auditValues['actorUserId']).toBe('owner-user');

    const memberValues = inserts[1]?.values as Record<string, unknown>;
    expect(memberValues['role']).toBe('owner');
    expect(memberValues['status']).toBe('active');
    expect(memberValues['joinedAt']).toBeInstanceOf(Date);

    expect(result.membership.organizationId).toBe('org-inserted-id');
    expect(result.membership.role).toBe('owner');
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('throws OrgSlugConflictError after repeated slug collisions without override', async () => {
    const { limit } = makeSlugLookupDb(mockDb);
    limit.mockResolvedValue([{ id: 'phantom-org' }]);

    await expect(
      createOrganization({
        name: 'Conflict Co',
        ownerUserId: 'owner-user',
      }),
    ).rejects.toBeInstanceOf(OrgSlugConflictError);
  });

  it('rejects blank names', async () => {
    await expect(createOrganization({ name: '   ', ownerUserId: 'u' })).rejects.toThrow(
      'Invalid organization name',
    );
  });
});
