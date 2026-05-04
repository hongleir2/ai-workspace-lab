import {
  db,
  eq,
  organizationMemberships,
  organizations,
  planLimits,
  plans,
  subscriptions,
  usageCounters,
  users,
} from '@ai-workspace-lab/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertFeatureAllowed,
  checkEntitlement,
  checkQuota,
  getOrganizationPlan,
  getPlanLimits,
} from './service.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('entitlements service integration', () => {
  const suffix = crypto.randomUUID().slice(0, 8);

  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    await db
      .insert(plans)
      .values({
        id: `free-${suffix}`,
        name: 'Free',
        billingInterval: 'none',
        priceCents: 0,
        currency: 'usd',
        isActive: true,
        sortOrder: 0,
      })
      .onConflictDoNothing();

    await db
      .insert(planLimits)
      .values([
        {
          planId: `free-${suffix}`,
          featureKey: 'ai_messages',
          limitValue: 10,
          limitUnit: 'count',
          resetInterval: 'day',
          hardLimit: true,
        },
        {
          planId: `free-${suffix}`,
          featureKey: 'document_uploads',
          limitValue: 3,
          limitUnit: 'count',
          resetInterval: 'month',
          hardLimit: true,
        },
        {
          planId: `free-${suffix}`,
          featureKey: 'max_file_size_mb',
          limitValue: 10,
          limitUnit: 'mb',
          resetInterval: 'none',
          hardLimit: true,
        },
      ])
      .onConflictDoNothing();

    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `ent-test-${suffix}`,
        email: `ent-${suffix}@example.com`,
        status: 'active',
      })
      .returning({ id: users.id });
    userId = user?.id ?? '';
    if (!userId) throw new Error('Failed to seed user');

    const [org] = await db
      .insert(organizations)
      .values({
        name: `Ent Test Org ${suffix}`,
        slug: `ent-test-${suffix}`,
        ownerUserId: userId,
        status: 'active',
      })
      .returning({ id: organizations.id });
    orgId = org?.id ?? '';
    if (!orgId) throw new Error('Failed to seed org');

    await db.insert(subscriptions).values({
      organizationId: orgId,
      planId: `free-${suffix}`,
      status: 'free',
      seats: 1,
      cancelAtPeriodEnd: false,
    });
  });

  afterAll(async () => {
    await db.delete(usageCounters).where(eq(usageCounters.organizationId, orgId));
    await db.delete(subscriptions).where(eq(subscriptions.organizationId, orgId));
    await db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(planLimits).where(eq(planLimits.planId, `free-${suffix}`));
    await db.delete(plans).where(eq(plans.id, `free-${suffix}`));
  });

  describe('getOrganizationPlan', () => {
    it('returns free plan for seeded org', async () => {
      const result = await getOrganizationPlan(orgId);
      expect(result.subscription.organizationId).toBe(orgId);
      expect(result.subscription.status).toBe('free');
      expect(result.plan.id).toBe(`free-${suffix}`);
    });

    it('throws NO_ACTIVE_SUBSCRIPTION for unknown org', async () => {
      await expect(getOrganizationPlan(crypto.randomUUID())).rejects.toMatchObject({
        name: 'EntitlementError',
        code: 'NO_ACTIVE_SUBSCRIPTION',
      });
    });
  });

  describe('getPlanLimits', () => {
    it('returns all 3 limits for the free plan', async () => {
      const limits = await getPlanLimits(`free-${suffix}`);
      expect(limits).toHaveLength(3);
      const keys = limits.map((l) => l.featureKey).sort();
      expect(keys).toEqual(['ai_messages', 'document_uploads', 'max_file_size_mb']);
    });

    it('returns filtered limit for ai_messages with limitValue 10 and resetInterval day', async () => {
      const limits = await getPlanLimits(`free-${suffix}`, 'ai_messages');
      expect(limits).toHaveLength(1);
      expect(limits[0]?.limitValue).toBe(10);
      expect(limits[0]?.resetInterval).toBe('day');
    });
  });

  describe('checkEntitlement', () => {
    it('returns true for included feature (ai_messages)', async () => {
      expect(await checkEntitlement(orgId, 'ai_messages')).toBe(true);
    });

    it('returns false for excluded feature (video_export)', async () => {
      expect(await checkEntitlement(orgId, 'video_export')).toBe(false);
    });
  });

  describe('checkQuota', () => {
    it('returns true when no usage counter exists (0 used)', async () => {
      expect(await checkQuota(orgId, 'ai_messages')).toBe(true);
    });

    it('returns false when usage counter equals limitValue (10/10 for ai_messages)', async () => {
      const now = new Date();
      const periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const periodEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
      );

      await db.insert(usageCounters).values({
        organizationId: orgId,
        featureKey: 'ai_messages',
        periodStart,
        periodEnd,
        usedQuantity: '10',
      });

      expect(await checkQuota(orgId, 'ai_messages')).toBe(false);

      await db.delete(usageCounters).where(eq(usageCounters.organizationId, orgId));
    });

    it('returns true for static limit (max_file_size_mb, resetInterval = none)', async () => {
      expect(await checkQuota(orgId, 'max_file_size_mb')).toBe(true);
    });
  });

  describe('assertFeatureAllowed', () => {
    it('resolves when feature is included and within quota', async () => {
      await expect(assertFeatureAllowed(orgId, 'ai_messages')).resolves.toBeUndefined();
    });

    it('throws FEATURE_NOT_INCLUDED for excluded feature', async () => {
      await expect(assertFeatureAllowed(orgId, 'video_export')).rejects.toMatchObject({
        name: 'EntitlementError',
        code: 'FEATURE_NOT_INCLUDED',
      });
    });

    it('throws QUOTA_EXCEEDED when counter at limit (document_uploads: 3/3)', async () => {
      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const periodEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
      );

      await db.insert(usageCounters).values({
        organizationId: orgId,
        featureKey: 'document_uploads',
        periodStart,
        periodEnd,
        usedQuantity: '3',
      });

      await expect(assertFeatureAllowed(orgId, 'document_uploads')).rejects.toMatchObject({
        name: 'EntitlementError',
        code: 'QUOTA_EXCEEDED',
      });

      await db.delete(usageCounters).where(eq(usageCounters.organizationId, orgId));
    });
  });
});
