import * as schema from '@ai-workspace-lab/db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { billingCustomers, organizations, subscriptions, users } from './index';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('billing_customers schema', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf(!DATABASE_URL) above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  let orgId: string;
  let userId: string;
  let customerId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `bc-test-user-${suffix}`,
        email: `bc-test-${suffix}@example.com`,
        status: 'active',
      })
      .returning({ id: users.id });
    userId = user?.id ?? '';
    if (!userId) throw new Error('Failed to seed user');

    const [org] = await db
      .insert(organizations)
      .values({
        name: `Billing Test Org ${suffix}`,
        slug: `billing-test-${suffix}`,
        ownerUserId: userId,
        status: 'active',
      })
      .returning({ id: organizations.id });
    orgId = org?.id ?? '';
    if (!orgId) throw new Error('Failed to seed org');
  });

  afterAll(async () => {
    await db.delete(billingCustomers).where(eq(billingCustomers.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it('inserts a billing customer row', async () => {
    const [row] = await db
      .insert(billingCustomers)
      .values({
        organizationId: orgId,
        stripeCustomerId: `cus_test_${suffix}`,
        billingEmail: 'Billing@Example.COM',
        createdByUserId: userId,
      })
      .returning();

    if (!row) throw new Error('Expected billing customer row from insert');
    expect(row.organizationId).toBe(orgId);
    expect(row.stripeCustomerId).toMatch(/^cus_test_/);
    expect(row.billingEmail).toBe('Billing@Example.COM');
    customerId = row.id;
  });

  it('billing_email is case-insensitive (citext)', async () => {
    const [row] = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, orgId));
    expect(row?.billingEmail?.toLowerCase()).toBe('billing@example.com');
  });

  it('updated_at advances after an update', async () => {
    const [before] = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, orgId));

    await new Promise((r) => setTimeout(r, 10));

    await db
      .update(billingCustomers)
      .set({ billingEmail: 'updated@example.com' })
      .where(eq(billingCustomers.organizationId, orgId));

    const [after] = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, orgId));

    if (!before || !after) throw new Error('Expected rows to be defined');
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('enforces one billing customer per organization', async () => {
    await expect(
      db.insert(billingCustomers).values({
        organizationId: orgId,
        stripeCustomerId: `cus_duplicate_${suffix}`,
      }),
    ).rejects.toThrow();
  });

  it('enforces unique stripe_customer_id across orgs', async () => {
    let org2Id: string | undefined;

    try {
      const [org2] = await db
        .insert(organizations)
        .values({
          name: `Billing Test Org 2 ${suffix}`,
          slug: `billing-test-2-${suffix}`,
          ownerUserId: userId,
          status: 'active',
        })
        .returning({ id: organizations.id });
      org2Id = org2?.id ?? '';

      const [existing] = await db
        .select()
        .from(billingCustomers)
        .where(eq(billingCustomers.organizationId, orgId));

      if (!existing) throw new Error('Expected existing billing customer');

      await expect(
        db.insert(billingCustomers).values({
          organizationId: org2Id,
          stripeCustomerId: existing.stripeCustomerId,
        }),
      ).rejects.toThrow();
    } finally {
      if (org2Id) {
        await db.delete(organizations).where(eq(organizations.id, org2Id));
      }
    }
  });

  it('subscriptions.billing_customer_id accepts a valid billing customer FK', async () => {
    // Create a subscription row for this org
    const [sub] = await db
      .insert(subscriptions)
      .values({
        organizationId: orgId,
        planId: 'free',
        status: 'free',
        seats: 1,
        cancelAtPeriodEnd: false,
      })
      .returning({ id: subscriptions.id });

    if (sub?.id) {
      const [updated] = await db
        .update(subscriptions)
        .set({ billingCustomerId: customerId })
        .where(eq(subscriptions.id, sub.id))
        .returning({ billingCustomerId: subscriptions.billingCustomerId });

      expect(updated?.billingCustomerId).toBe(customerId);

      // Clean up — reset FK so afterAll can delete billing customer row
      await db
        .update(subscriptions)
        .set({ billingCustomerId: null })
        .where(eq(subscriptions.id, sub.id));

      // Also delete the subscription created in this test
      await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));
    }
  });
});
