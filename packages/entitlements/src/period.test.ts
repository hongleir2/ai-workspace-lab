import type { Subscription } from '@ai-workspace-lab/db';
import { describe, expect, it } from 'vitest';
import { getCurrentBillingPeriod } from './period.js';

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
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
    ...overrides,
  } as Subscription;
}

describe('getCurrentBillingPeriod', () => {
  it('returns null for resetInterval=none', () => {
    expect(getCurrentBillingPeriod(makeSub(), 'none')).toBeNull();
  });

  it('returns today UTC bounds for resetInterval=day', () => {
    const result = getCurrentBillingPeriod(makeSub(), 'day');
    expect(result).not.toBeNull();
    const now = new Date();
    expect(result?.start.getUTCHours()).toBe(0);
    expect(result?.start.getUTCMinutes()).toBe(0);
    expect(result?.end.getUTCHours()).toBe(23);
    expect(result?.end.getUTCMinutes()).toBe(59);
    expect(result?.start.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(result?.start.getUTCMonth()).toBe(now.getUTCMonth());
    expect(result?.start.getUTCDate()).toBe(now.getUTCDate());
  });

  it('returns current calendar month for resetInterval=month', () => {
    const result = getCurrentBillingPeriod(makeSub(), 'month');
    expect(result).not.toBeNull();
    const now = new Date();
    expect(result?.start.getUTCDate()).toBe(1);
    expect(result?.start.getUTCMonth()).toBe(now.getUTCMonth());
    expect(result?.end.getUTCMonth()).toBe(now.getUTCMonth());
  });

  it('uses subscription period dates for billing_period when present', () => {
    const start = new Date('2026-05-01T00:00:00Z');
    const end = new Date('2026-05-31T23:59:59Z');
    const result = getCurrentBillingPeriod(
      makeSub({ currentPeriodStart: start, currentPeriodEnd: end }),
      'billing_period',
    );
    expect(result).not.toBeNull();
    expect(result?.start).toEqual(start);
    expect(result?.end).toEqual(end);
  });

  it('falls back to calendar month for billing_period when subscription has no period dates (free plan)', () => {
    const result = getCurrentBillingPeriod(makeSub(), 'billing_period');
    expect(result).not.toBeNull();
    const now = new Date();
    expect(result?.start.getUTCDate()).toBe(1);
    expect(result?.start.getUTCMonth()).toBe(now.getUTCMonth());
  });
});
