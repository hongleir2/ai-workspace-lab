/**
 * Integration test for the organization_memberships migration.
 *
 * Requires a real Postgres instance with migrations applied.
 * Skipped automatically when DATABASE_URL is absent.
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { organizationMemberships } from './organization_memberships.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('organization_memberships table', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  let userId: string;
  let orgId: string;
  let membershipId: string;

  beforeAll(async () => {
    // Look up the org by slug first so we can clean up membership rows before
    // deleting the org (the FK on organization_id has no cascade).
    const existing = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, 'membership-test-org'));
    if (existing[0]) {
      await db
        .delete(organizationMemberships)
        .where(eq(organizationMemberships.organizationId, existing[0].id));
    }
    await db.delete(organizations).where(eq(organizations.slug, 'membership-test-org'));
    await db.delete(users).where(eq(users.email, 'membership-test@example.com'));

    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'membership-test-uid-001',
        email: 'membership-test@example.com',
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    userId = user!.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: 'Membership Test Org', slug: 'membership-test-org', status: 'active' })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    orgId = org!.id;
  });

  afterAll(async () => {
    if (membershipId) {
      await db.delete(organizationMemberships).where(eq(organizationMemberships.id, membershipId));
    }
    if (orgId) {
      await db.delete(organizations).where(eq(organizations.id, orgId));
    }
    if (userId) {
      await db.delete(users).where(eq(users.id, userId));
    }
    await client.end();
  });

  it('inserts a membership row', async () => {
    const [row] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: orgId,
        userId,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      })
      .returning();

    expect(row).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    membershipId = row!.id;
    expect(row?.organizationId).toBe(orgId);
    expect(row?.userId).toBe(userId);
    expect(row?.role).toBe('owner');
    expect(row?.status).toBe('active');
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  it('unique index rejects duplicate (organization_id, user_id)', async () => {
    await expect(
      db.insert(organizationMemberships).values({
        organizationId: orgId,
        userId,
        role: 'member',
        status: 'active',
      }),
    ).rejects.toThrow();
  });

  it('updated_at advances on update', async () => {
    const before = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.id, membershipId));
    const originalUpdatedAt = before[0]?.updatedAt;

    await new Promise((r) => setTimeout(r, 10));

    await db
      .update(organizationMemberships)
      .set({ role: 'admin' })
      .where(eq(organizationMemberships.id, membershipId));

    const after = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.id, membershipId));
    expect(after[0]?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() ?? 0);
  });

  it('allows null joined_at', async () => {
    const [second] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'membership-test-uid-002',
        email: 'membership-test-2@example.com',
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    const secondUserId = second!.id;

    const [row] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: orgId,
        userId: secondUserId,
        role: 'member',
        status: 'invited',
      })
      .returning();

    expect(row?.joinedAt).toBeNull();

    // biome-ignore lint/style/noNonNullAssertion: row was just inserted above
    await db.delete(organizationMemberships).where(eq(organizationMemberships.id, row!.id));
    await db.delete(users).where(eq(users.id, secondUserId));
  });
});
