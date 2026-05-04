import * as schema from '@ai-workspace-lab/db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { organizationMemberships, organizations, plans, subscriptions, users } from './index';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('subscriptions schema', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf(!DATABASE_URL) above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    await db
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

    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `sub-test-${suffix}`,
        email: `sub-${suffix}@example.com`,
        status: 'active',
      })
      .returning({ id: users.id });
    userId = user?.id ?? '';
    if (!userId) throw new Error('Failed to seed user');

    const [org] = await db
      .insert(organizations)
      .values({
        name: `Sub Test Org ${suffix}`,
        slug: `sub-test-${suffix}`,
        ownerUserId: userId,
        status: 'active',
      })
      .returning({ id: organizations.id });
    orgId = org?.id ?? '';
    if (!orgId) throw new Error('Failed to seed org');
  });

  afterAll(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.organizationId, orgId));
    await db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it('inserts a free subscription linked to an org', async () => {
    const [sub] = await db
      .insert(subscriptions)
      .values({
        organizationId: orgId,
        planId: 'free',
        status: 'free',
        seats: 1,
        cancelAtPeriodEnd: false,
      })
      .returning();

    expect(sub?.organizationId).toBe(orgId);
    expect(sub?.planId).toBe('free');
    expect(sub?.status).toBe('free');
    expect(sub?.billingCustomerId).toBeNull();
    expect(sub?.stripeSubscriptionId).toBeNull();
    expect(sub?.canceledAt).toBeNull();
    expect(sub?.endedAt).toBeNull();
  });

  it('enforces partial UNIQUE constraint on organization_id for active status', async () => {
    await expect(
      db.insert(subscriptions).values({
        organizationId: orgId,
        planId: 'free',
        status: 'free',
        seats: 1,
        cancelAtPeriodEnd: false,
      }),
    ).rejects.toThrow();
  });

  it('allows a second subscription row in canceled status (partial index permits it)', async () => {
    // canceled rows are outside the partial unique index — multiple canceled rows are fine
    await db.insert(subscriptions).values({
      organizationId: orgId,
      planId: 'free',
      status: 'canceled',
      seats: 1,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      endedAt: new Date(),
    });
    // No error expected
  });
});
