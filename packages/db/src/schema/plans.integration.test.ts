import * as schema from '@ai-workspace-lab/db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { planLimits, plans } from './index';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('plans schema', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf(!DATABASE_URL) above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  const planId = `test_plan_${crypto.randomUUID().slice(0, 8)}`;

  afterAll(async () => {
    await db.delete(planLimits).where(eq(planLimits.planId, planId));
    await db.delete(plans).where(eq(plans.id, planId));
    await client.end();
  });

  it('inserts a plan with correct metadata shape', async () => {
    const [plan] = await db
      .insert(plans)
      .values({
        id: planId,
        name: 'Test Plan',
        billingInterval: 'month',
        priceCents: 1900,
        currency: 'usd',
        isActive: true,
        sortOrder: 99,
      })
      .returning();

    expect(plan?.id).toBe(planId);
    expect(plan?.billingInterval).toBe('month');
    expect(plan?.priceCents).toBe(1900);
    expect(plan?.isActive).toBe(true);
    expect(plan?.createdAt).toBeInstanceOf(Date);
    expect(plan?.updatedAt).toBeInstanceOf(Date);
  });

  it('enforces UNIQUE constraint on (plan_id, feature_key)', async () => {
    await db.insert(planLimits).values({
      planId,
      featureKey: 'ai_messages',
      limitValue: 10,
      limitUnit: 'count',
      resetInterval: 'day',
      hardLimit: true,
    });

    await expect(
      db.insert(planLimits).values({
        planId,
        featureKey: 'ai_messages',
        limitValue: 20,
        limitUnit: 'count',
        resetInterval: 'day',
        hardLimit: true,
      }),
    ).rejects.toThrow();
  });

  it('allows nullable limit_value (unlimited)', async () => {
    const [limit] = await db
      .insert(planLimits)
      .values({
        planId,
        featureKey: 'storage_gb',
        limitValue: null,
        limitUnit: 'mb',
        resetInterval: 'none',
        hardLimit: false,
      })
      .returning();

    expect(limit?.limitValue).toBeNull();
    expect(limit?.hardLimit).toBe(false);
  });
});
