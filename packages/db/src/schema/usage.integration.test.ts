import * as schema from '@ai-workspace-lab/db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { organizationMemberships, organizations, usageCounters, usageEvents, users } from './index';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('usage tables schema', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf(!DATABASE_URL) above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `usage-test-${suffix}`,
        email: `usage-${suffix}@example.com`,
        status: 'active',
      })
      .returning({ id: users.id });
    userId = user?.id ?? '';
    if (!userId) throw new Error('Failed to seed user');

    const [org] = await db
      .insert(organizations)
      .values({
        name: `Usage Test Org ${suffix}`,
        slug: `usage-test-${suffix}`,
        ownerUserId: userId,
        status: 'active',
      })
      .returning({ id: organizations.id });
    orgId = org?.id ?? '';
    if (!orgId) throw new Error('Failed to seed org');
  });

  afterAll(async () => {
    await db.delete(usageCounters).where(eq(usageCounters.organizationId, orgId));
    await db.delete(usageEvents).where(eq(usageEvents.organizationId, orgId));
    await db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  describe('usage_events', () => {
    it('inserts a usage event', async () => {
      const [event] = await db
        .insert(usageEvents)
        .values({
          organizationId: orgId,
          userId,
          featureKey: 'ai_messages',
          eventType: 'ai_chat_completed',
          quantity: '1',
          unit: 'count',
          idempotencyKey: `test-idem-${suffix}`,
        })
        .returning();

      expect(event?.organizationId).toBe(orgId);
      expect(event?.featureKey).toBe('ai_messages');
      expect(event?.unit).toBe('count');
      expect(event?.idempotencyKey).toBe(`test-idem-${suffix}`);
    });

    it('enforces UNIQUE constraint on idempotency_key', async () => {
      await expect(
        db.insert(usageEvents).values({
          organizationId: orgId,
          featureKey: 'ai_messages',
          eventType: 'ai_chat_completed',
          quantity: '1',
          unit: 'count',
          idempotencyKey: `test-idem-${suffix}`,
        }),
      ).rejects.toThrow();
    });

    it('allows multiple rows with null idempotency_key', async () => {
      await db.insert(usageEvents).values({
        organizationId: orgId,
        featureKey: 'ai_messages',
        eventType: 'ai_chat_completed',
        quantity: '1',
        unit: 'count',
      });
      await db.insert(usageEvents).values({
        organizationId: orgId,
        featureKey: 'ai_messages',
        eventType: 'ai_chat_completed',
        quantity: '1',
        unit: 'count',
      });
      // No error: multiple NULLs are allowed in a UNIQUE index
    });
  });

  describe('usage_counters', () => {
    const periodStart = new Date('2026-05-01T00:00:00Z');
    const periodEnd = new Date('2026-06-01T00:00:00Z');

    it('inserts a usage counter', async () => {
      const [counter] = await db
        .insert(usageCounters)
        .values({
          organizationId: orgId,
          featureKey: 'ai_messages',
          periodStart,
          periodEnd,
          usedQuantity: '5',
          limitQuantity: '10',
        })
        .returning();

      expect(counter?.organizationId).toBe(orgId);
      expect(counter?.usedQuantity).toBe('5');
      expect(counter?.limitQuantity).toBe('10');
    });

    it('enforces UNIQUE constraint on (org, feature, period_start, period_end)', async () => {
      await expect(
        db.insert(usageCounters).values({
          organizationId: orgId,
          featureKey: 'ai_messages',
          periodStart,
          periodEnd,
          usedQuantity: '7',
        }),
      ).rejects.toThrow();
    });
  });
});
