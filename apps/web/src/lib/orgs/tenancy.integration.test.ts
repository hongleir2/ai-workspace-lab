/**
 * Tenancy isolation integration tests — require `DATABASE_URL` and migrated schema.
 *
 * Verifies that:
 *  - org creator receives owner role
 *  - getUserOrganizations never leaks another user's orgs
 *  - audit log is written with required fields on org creation
 */

import type { Database } from '@ai-workspace-lab/db';
import {
  auditLogs,
  eq,
  inArray,
  organizationMemberships,
  organizations,
  plans,
  subscriptions,
  users,
} from '@ai-workspace-lab/db';
import * as schema from '@ai-workspace-lab/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOrganization, getUserOrganizations } from './service.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('tenancy isolation', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf(!DATABASE_URL) above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const drizzleDb = drizzle(client, { schema, casing: 'snake_case' });
  const pg = drizzleDb as unknown as Database;

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    await drizzleDb
      .insert(plans)
      .values({
        id: 'free',
        name: 'Free',
        billingInterval: 'none',
        priceCents: 0,
        currency: 'usd',
        isActive: true,
        sortOrder: 0,
      })
      .onConflictDoNothing();

    const [userA] = await drizzleDb
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `d20-a-${suffix}`,
        email: `d20-a-${suffix}@example.com`,
        status: 'active',
      })
      .returning({ id: users.id });

    const [userB] = await drizzleDb
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `d20-b-${suffix}`,
        email: `d20-b-${suffix}@example.com`,
        status: 'active',
      })
      .returning({ id: users.id });

    userAId = userA?.id ?? '';
    userBId = userB?.id ?? '';
    if (!userAId || !userBId) throw new Error('Failed to seed test users');
  });

  afterAll(async () => {
    const userIds = [userAId, userBId].filter(Boolean);
    if (userIds.length > 0) {
      const memberRows = await drizzleDb
        .select({ oid: organizationMemberships.organizationId })
        .from(organizationMemberships)
        .where(inArray(organizationMemberships.userId, userIds));

      const uniqueOrgIds = [...new Set(memberRows.map((r) => r.oid))];
      if (uniqueOrgIds.length > 0) {
        await drizzleDb
          .delete(subscriptions)
          .where(inArray(subscriptions.organizationId, uniqueOrgIds));
        await drizzleDb.delete(auditLogs).where(inArray(auditLogs.organizationId, uniqueOrgIds));
        await drizzleDb
          .delete(organizationMemberships)
          .where(inArray(organizationMemberships.organizationId, uniqueOrgIds));
        await drizzleDb.delete(organizations).where(inArray(organizations.id, uniqueOrgIds));
      }
      await drizzleDb.delete(users).where(inArray(users.id, userIds));
    }
    await client.end();
  });

  it('creator receives owner role with active status', async () => {
    const { membership } = await createOrganization(
      { name: `Owner Test ${suffix}`, slugOverride: `owner-test-${suffix}`, ownerUserId: userAId },
      pg,
    );

    expect(membership.role).toBe('owner');
    expect(membership.status).toBe('active');
    expect(membership.userId).toBe(userAId);
  });

  it('getUserOrganizations does not return orgs the user has no membership in', async () => {
    const listB = await getUserOrganizations(userBId, pg);
    const ownerIds = listB.map((r) => r.organization.ownerUserId);
    expect(ownerIds).not.toContain(userAId);
  });

  it('each user only sees their own orgs', async () => {
    const { organization: orgA } = await createOrganization(
      { name: `Org A ${suffix}`, slugOverride: `org-a-${suffix}`, ownerUserId: userAId },
      pg,
    );
    const { organization: orgB } = await createOrganization(
      { name: `Org B ${suffix}`, slugOverride: `org-b-${suffix}`, ownerUserId: userBId },
      pg,
    );

    const [listA, listB] = await Promise.all([
      getUserOrganizations(userAId, pg),
      getUserOrganizations(userBId, pg),
    ]);

    const slugsA = listA.map((r) => r.organization.slug);
    const slugsB = listB.map((r) => r.organization.slug);

    expect(slugsA).toContain(orgA.slug);
    expect(slugsA).not.toContain(orgB.slug);

    expect(slugsB).toContain(orgB.slug);
    expect(slugsB).not.toContain(orgA.slug);
  });

  it('audit log records org creation with required fields', async () => {
    const { organization } = await createOrganization(
      { name: `Audit Test ${suffix}`, slugOverride: `audit-${suffix}`, ownerUserId: userAId },
      pg,
    );

    const logs = await drizzleDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organization.id));

    const entry = logs.find((l) => l.action === 'organization.created');

    expect(entry).toBeDefined();
    expect(entry?.organizationId).toBe(organization.id);
    expect(entry?.actorUserId).toBe(userAId);
    expect(entry?.entityType).toBe('organization');
    expect(entry?.entityId).toBe(organization.id);
    expect(entry?.afterState).toMatchObject({
      name: expect.any(String),
      slug: organization.slug,
    });
    expect(entry?.createdAt).toBeInstanceOf(Date);
  });
});
