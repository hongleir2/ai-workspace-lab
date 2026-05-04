/**
 * Integration tests — require `DATABASE_URL` and migrated schema (pnpm db:migrate).
 */

import type { AuditLog, Database } from '@ai-workspace-lab/db';
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
import {
  OrgSlugConflictError,
  createOrganization,
  getOrganizationBySlug,
  getUserOrganizations,
} from './service.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('orgs service integration', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  let ownerUserId: string;
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf(!DATABASE_URL) above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const drizzleDb = drizzle(client, { schema, casing: 'snake_case' });
  const pg = drizzleDb as unknown as Database;

  const email = `d17-org-svc-${suffix}@example.com`;

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

    const [owner] = await drizzleDb
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `d17-${suffix}`,
        email,
        status: 'active',
      })
      .returning({ id: users.id });

    ownerUserId = owner?.id ?? '';
    if (!ownerUserId) throw new Error('Failed to seed owner user');
  });

  afterAll(async () => {
    const membershipRows = await drizzleDb
      .select({ oid: organizationMemberships.organizationId })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, ownerUserId));

    const uniqueOrgIds = [...new Set(membershipRows.map((row) => row.oid))];

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

    await drizzleDb.delete(users).where(eq(users.id, ownerUserId));
    await client.end();
  });

  it('commits organization, membership, and audit atomically on happy path', async () => {
    const { organization, membership } = await createOrganization(
      {
        name: `Day17 Org ${suffix}`,
        ownerUserId,
      },
      pg,
    );

    expect(organization.slug).toMatch(/^day17-org-/);
    expect(membership.role).toBe('owner');
    expect(membership.status).toBe('active');

    const logs: AuditLog[] = await drizzleDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organization.id));

    const created = logs.find((entry) => entry.action === 'organization.created');

    expect(created?.entityType).toBe('organization');
    expect(created?.entityId).toBe(organization.id);
    expect(created?.afterState).toEqual({ name: `Day17 Org ${suffix}`, slug: organization.slug });
  });

  it('rolls back all rows when audit insert violates FK', async () => {
    const slugRoll = `d17-roll-${suffix}`;

    await expect(
      drizzleDb.transaction(async (tx) => {
        const orgRow = await tx
          .insert(organizations)
          .values({
            name: `Rollback ${suffix}`,
            slug: slugRoll,
            ownerUserId,
            status: 'active',
          })
          .returning();
        const org = orgRow[0];
        if (!org) throw new Error('expected org');

        await tx.insert(organizationMemberships).values({
          organizationId: org.id,
          userId: ownerUserId,
          role: 'owner',
          status: 'active',
          joinedAt: new Date(),
        });

        await tx.insert(auditLogs).values({
          organizationId: org.id,
          actorUserId: '00000000-0000-4000-8000-000000000099',
          action: 'organization.created',
          entityType: 'organization',
          entityId: org.id,
          afterState: {},
        });
      }),
    ).rejects.toThrow();

    const orphaned = await getOrganizationBySlug(slugRoll, pg);
    expect(orphaned).toBeNull();
  });

  it('reports slug conflict when override collides citext-equal slug', async () => {
    const base = `citext-root-${suffix}`;

    await createOrganization({
      name: `Root ${suffix}`,
      slugOverride: base,
      ownerUserId,
    });

    await expect(
      createOrganization({
        name: `Dup ${suffix}`,
        slugOverride: base.toUpperCase(),
        ownerUserId,
      }),
    ).rejects.toBeInstanceOf(OrgSlugConflictError);
  });

  it('orders organizations by membership joined_at desc nulls last', async () => {
    const first = await createOrganization(
      {
        name: `Older ${suffix}`,
        slugOverride: `order-a-${suffix}`,
        ownerUserId,
      },
      pg,
    );

    await new Promise((resolve) => setTimeout(resolve, 55));

    const second = await createOrganization(
      {
        name: `Newer ${suffix}`,
        slugOverride: `order-b-${suffix}`,
        ownerUserId,
      },
      pg,
    );

    const list = await getUserOrganizations(ownerUserId, pg);
    expect(
      list.findIndex((row) => row.organization.slug === second.organization.slug),
    ).toBeLessThan(list.findIndex((row) => row.organization.slug === first.organization.slug));
  });
});
