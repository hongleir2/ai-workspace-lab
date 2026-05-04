import { db, eq, organizations, usageCounters, usageEvents, users } from '@ai-workspace-lab/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getUsageForFeature,
  getUsageSummaryForOrganization,
  recordUsageWithCounter,
} from './service.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('usage service integration', () => {
  const suffix = crypto.randomUUID().slice(0, 8);

  let userId: string;
  let orgId: string;

  const periodStart = new Date('2026-05-01T00:00:00.000Z');
  const periodEnd = new Date('2026-06-01T00:00:00.000Z');
  const period = { start: periodStart, end: periodEnd };
  const idempotencyKey = `usage-day24-${suffix}`;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `usage-svc-test-${suffix}`,
        email: `usage-svc-${suffix}@example.com`,
        status: 'active',
      })
      .returning({ id: users.id });
    userId = user?.id ?? '';
    if (!userId) throw new Error('Failed to seed user');

    const [org] = await db
      .insert(organizations)
      .values({
        name: `Usage Svc Test Org ${suffix}`,
        slug: `usage-svc-test-${suffix}`,
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
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('recordUsageWithCounter is idempotent; counter matches; summary lists org counters', async () => {
    const first = await recordUsageWithCounter({
      event: {
        organizationId: orgId,
        userId,
        featureKey: 'ai_messages',
        eventType: 'ai_chat_completed',
        quantity: '1',
        unit: 'count',
        idempotencyKey,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
      },
      period,
    });

    expect(first.inserted).toBe(true);
    if (first.inserted) {
      expect(first.event.organizationId).toBe(orgId);
    }

    const afterFirst = await getUsageForFeature(orgId, 'ai_messages', period);
    expect(afterFirst?.usedQuantity).toBe('1');

    const summaryOnce = await getUsageSummaryForOrganization(orgId);
    expect(summaryOnce.some((r) => r.featureKey === 'ai_messages' && r.usedQuantity === '1')).toBe(
      true,
    );

    const second = await recordUsageWithCounter({
      event: {
        organizationId: orgId,
        userId,
        featureKey: 'ai_messages',
        eventType: 'ai_chat_completed',
        quantity: '1',
        unit: 'count',
        idempotencyKey,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
      },
      period,
    });

    expect(second.inserted).toBe(false);

    const afterSecond = await getUsageForFeature(orgId, 'ai_messages', period);
    expect(afterSecond?.usedQuantity).toBe('1');
  });
});
