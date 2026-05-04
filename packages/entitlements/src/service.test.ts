import type { Plan, PlanLimit, Subscription } from '@ai-workspace-lab/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
  },
}));

vi.mock('@ai-workspace-lab/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ai-workspace-lab/db')>();
  return { ...actual, db: mockDb };
});

import {
  assertFeatureAllowed,
  checkEntitlement,
  checkQuota,
  getOrganizationPlan,
  getPlanLimits,
} from './service.js';

const mockPlan: Plan = {
  id: 'free',
  name: 'Free',
  billingInterval: 'none',
  priceCents: 0,
  currency: 'usd',
  stripePriceId: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSub: Subscription = {
  id: 'sub-1',
  organizationId: 'org-1',
  billingCustomerId: null,
  planId: 'free',
  stripeSubscriptionId: null,
  stripePriceId: null,
  status: 'free',
  seats: 1,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  endedAt: null,
  trialEnd: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockLimit: PlanLimit = {
  id: 'lim-1',
  planId: 'free',
  featureKey: 'ai_messages',
  limitValue: 10,
  limitUnit: 'count',
  resetInterval: 'day',
  hardLimit: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeOrgPlanChain(resolveWith: unknown[]) {
  const limit = vi.fn().mockResolvedValue(resolveWith);
  const where = vi.fn().mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  return { from, innerJoin, where, limit };
}

function makeWhereChain(resolveWith: unknown[]) {
  const where = vi.fn().mockResolvedValue(resolveWith);
  const from = vi.fn().mockReturnValue({ where });
  return { from, where };
}

describe('getOrganizationPlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns subscription and plan when active subscription exists', async () => {
    const chain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    mockDb.select.mockReturnValue({ from: chain.from });

    const result = await getOrganizationPlan('org-1');
    expect(result.subscription.planId).toBe('free');
    expect(result.plan.id).toBe('free');
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('throws EntitlementError(NO_ACTIVE_SUBSCRIPTION) when no row', async () => {
    const chain = makeOrgPlanChain([]);
    mockDb.select.mockReturnValue({ from: chain.from });

    await expect(getOrganizationPlan('org-missing')).rejects.toMatchObject({
      name: 'EntitlementError',
      code: 'NO_ACTIVE_SUBSCRIPTION',
    });
  });
});

describe('getPlanLimits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all limits for a plan when no featureKey filter', async () => {
    const chain = makeWhereChain([mockLimit]);
    mockDb.select.mockReturnValue({ from: chain.from });

    const result = await getPlanLimits('free');
    expect(result).toHaveLength(1);
    expect(result[0]?.featureKey).toBe('ai_messages');
  });

  it('returns filtered limits when featureKey is provided', async () => {
    const chain = makeWhereChain([mockLimit]);
    mockDb.select.mockReturnValue({ from: chain.from });

    const result = await getPlanLimits('free', 'ai_messages');
    expect(result).toHaveLength(1);
  });

  it('returns empty array when feature not in plan', async () => {
    const chain = makeWhereChain([]);
    mockDb.select.mockReturnValue({ from: chain.from });

    const result = await getPlanLimits('free', 'unknown_feature');
    expect(result).toHaveLength(0);
  });
});

describe('checkEntitlement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when feature has a plan_limits row', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([mockLimit]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from });

    expect(await checkEntitlement('org-1', 'ai_messages')).toBe(true);
  });

  it('returns false when feature has no plan_limits row', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from });

    expect(await checkEntitlement('org-1', 'video_export')).toBe(false);
  });
});

describe('checkQuota', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when no usage counter exists (0 used out of 10)', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([mockLimit]);
    const counterChain = makeWhereChain([]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from })
      .mockReturnValueOnce({ from: counterChain.from });

    expect(await checkQuota('org-1', 'ai_messages')).toBe(true);
  });

  it('returns true when used < limitValue', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([mockLimit]);
    const counterChain = makeWhereChain([{ usedQuantity: '5' }]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from })
      .mockReturnValueOnce({ from: counterChain.from });

    expect(await checkQuota('org-1', 'ai_messages')).toBe(true);
  });

  it('returns false when used >= limitValue', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([mockLimit]);
    const counterChain = makeWhereChain([{ usedQuantity: '10' }]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from })
      .mockReturnValueOnce({ from: counterChain.from });

    expect(await checkQuota('org-1', 'ai_messages')).toBe(false);
  });

  it('returns true for unlimited feature (limitValue = null)', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const unlimitedLimit = { ...mockLimit, limitValue: null };
    const limitsChain = makeWhereChain([unlimitedLimit]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from });

    expect(await checkQuota('org-1', 'ai_messages')).toBe(true);
  });

  it('returns true for static limit (resetInterval = none)', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const staticLimit = { ...mockLimit, resetInterval: 'none' as const };
    const limitsChain = makeWhereChain([staticLimit]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from });

    expect(await checkQuota('org-1', 'max_file_size_mb')).toBe(true);
  });

  it('returns false when feature has no plan_limits row', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from });

    expect(await checkQuota('org-1', 'video_export')).toBe(false);
  });
});

describe('assertFeatureAllowed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns void when feature is included and within quota', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([mockLimit]);
    const counterChain = makeWhereChain([{ usedQuantity: '5' }]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from })
      .mockReturnValueOnce({ from: counterChain.from });

    await expect(assertFeatureAllowed('org-1', 'ai_messages')).resolves.toBeUndefined();
  });

  it('throws FEATURE_NOT_INCLUDED when feature has no plan_limits row', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from });

    await expect(assertFeatureAllowed('org-1', 'video_export')).rejects.toMatchObject({
      name: 'EntitlementError',
      code: 'FEATURE_NOT_INCLUDED',
    });
  });

  it('throws QUOTA_EXCEEDED when used >= limitValue', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([mockLimit]);
    const counterChain = makeWhereChain([{ usedQuantity: '10' }]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from })
      .mockReturnValueOnce({ from: counterChain.from });

    await expect(assertFeatureAllowed('org-1', 'ai_messages')).rejects.toMatchObject({
      name: 'EntitlementError',
      code: 'QUOTA_EXCEEDED',
    });
  });

  it('returns void for unlimited feature (limitValue = null)', async () => {
    const orgPlanChain = makeOrgPlanChain([{ subscription: mockSub, plan: mockPlan }]);
    const limitsChain = makeWhereChain([{ ...mockLimit, limitValue: null }]);
    mockDb.select
      .mockReturnValueOnce({ from: orgPlanChain.from })
      .mockReturnValueOnce({ from: limitsChain.from });

    await expect(assertFeatureAllowed('org-1', 'ai_messages')).resolves.toBeUndefined();
  });
});
