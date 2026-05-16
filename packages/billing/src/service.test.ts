import type { BillingCustomer, Database, Plan } from '@ai-workspace-lab/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCustomersCreate, mockCheckoutSessionsCreate, mockPortalSessionsCreate } = vi.hoisted(
  () => ({
    mockCustomersCreate: vi.fn(),
    mockCheckoutSessionsCreate: vi.fn(),
    mockPortalSessionsCreate: vi.fn(),
  }),
);

vi.mock('./stripe', () => ({
  stripe: {
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalSessionsCreate } },
  },
}));

import {
  createBillingPortalSession,
  createCheckoutSession,
  getOrCreateStripeCustomer,
  mapStripePriceToPlan,
} from './service';

function makeSelectMock(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn, limit: limitFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  return { select: selectFn };
}

function makeInsertMock(rows: unknown[]) {
  const returningFn = vi.fn().mockResolvedValue(rows);
  const onConflictDoNothingFn = vi.fn().mockReturnValue({ returning: returningFn });
  const valuesFn = vi
    .fn()
    .mockReturnValue({ onConflictDoNothing: onConflictDoNothingFn, returning: returningFn });
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });
  return { insert: insertFn };
}

const fakePlan: Plan = {
  id: 'pro_monthly',
  name: 'Pro (Monthly)',
  billingInterval: 'month',
  priceCents: 1900,
  currency: 'usd',
  stripePriceId: 'price_abc',
  isActive: true,
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeCustomer: BillingCustomer = {
  id: 'bc-uuid',
  organizationId: 'org-uuid',
  stripeCustomerId: 'cus_test123',
  billingEmail: 'owner@example.com',
  createdByUserId: 'user-uuid',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('mapStripePriceToPlan', () => {
  it('returns plan when stripe_price_id matches', async () => {
    const mockDb = makeSelectMock([fakePlan]) as unknown as Database;
    const result = await mapStripePriceToPlan('price_abc', mockDb);
    expect(result).toEqual(fakePlan);
  });

  it('returns null when no plan matches', async () => {
    const mockDb = makeSelectMock([]) as unknown as Database;
    const result = await mapStripePriceToPlan('price_unknown', mockDb);
    expect(result).toBeNull();
  });
});

describe('getOrCreateStripeCustomer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns existing customer without calling Stripe', async () => {
    const mockDb = makeSelectMock([fakeCustomer]) as unknown as Database;
    const result = await getOrCreateStripeCustomer('org-uuid', 'Acme', null, null, mockDb);
    expect(result).toEqual(fakeCustomer);
    expect(mockCustomersCreate).not.toHaveBeenCalled();
  });

  it('creates Stripe customer and inserts row when none exists', async () => {
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new' });
    const mockDb = {
      ...makeSelectMock([]),
      ...makeInsertMock([fakeCustomer]),
    } as unknown as Database;

    const result = await getOrCreateStripeCustomer(
      'org-uuid',
      'Acme',
      'owner@example.com',
      'user-uuid',
      mockDb,
    );
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      name: 'Acme',
      email: 'owner@example.com',
      metadata: { organizationId: 'org-uuid' },
    });
    expect(result).toEqual(fakeCustomer);
  });
});

describe('createCheckoutSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the Stripe hosted checkout URL', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/cs_test_abc',
    });
    const mockDb = makeSelectMock([fakeCustomer]) as unknown as Database;

    const url = await createCheckoutSession(
      'org-uuid',
      'price_abc',
      'acme',
      'Acme',
      null,
      'user-uuid',
      'https://app.example.com',
      mockDb,
    );
    expect(url).toBe('https://checkout.stripe.com/pay/cs_test_abc');
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_test123',
        line_items: [{ price: 'price_abc', quantity: 1 }],
      }),
    );
  });
});

describe('createBillingPortalSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the portal URL', async () => {
    mockPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session/xxx' });
    const mockDb = makeSelectMock([fakeCustomer]) as unknown as Database;

    const url = await createBillingPortalSession(
      'org-uuid',
      'acme',
      'https://app.example.com',
      mockDb,
    );
    expect(url).toBe('https://billing.stripe.com/session/xxx');
    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_test123' }),
    );
  });

  it('throws when no billing customer exists', async () => {
    const mockDb = makeSelectMock([]) as unknown as Database;
    await expect(
      createBillingPortalSession('org-uuid', 'acme', 'https://app.example.com', mockDb),
    ).rejects.toThrow('No billing customer found');
  });
});
