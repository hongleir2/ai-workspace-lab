import { and } from '@ai-workspace-lab/db';
import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbInsert, mockDbUpdate, mockDbSelect, mockMapStripePriceToPlan, mockStripeRetrieve } =
  vi.hoisted(() => ({
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbSelect: vi.fn(),
    mockMapStripePriceToPlan: vi.fn(),
    mockStripeRetrieve: vi.fn(),
  }));

vi.mock('@ai-workspace-lab/db', () => ({
  db: {},
  eq: vi.fn(),
  and: vi.fn(),
  stripeEvents: {},
  billingCustomers: { stripeCustomerId: '' },
  subscriptions: { stripeSubscriptionId: '', status: '' },
}));

vi.mock('./service', () => ({ mapStripePriceToPlan: mockMapStripePriceToPlan }));
vi.mock('./stripe', () => ({
  stripe: { subscriptions: { retrieve: mockStripeRetrieve } },
}));

import type { Database } from '@ai-workspace-lab/db';
import { handleStripeEvent } from './webhook-handler';

function makeDb(insertReturns: unknown[]) {
  const stripeEventReturning = vi.fn().mockResolvedValue(insertReturns);
  const stripeEventOnConflict = vi.fn().mockReturnValue({ returning: stripeEventReturning });
  const stripeEventValues = vi.fn().mockReturnValue({ onConflictDoNothing: stripeEventOnConflict });
  mockDbInsert.mockReturnValue({ values: stripeEventValues });

  mockDbUpdate.mockImplementation(() => {
    const updateWhere = vi.fn().mockResolvedValue({});
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    return { set: updateSet };
  });

  const selectLimit = vi.fn().mockResolvedValue([]);
  const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere, limit: selectLimit });
  mockDbSelect.mockReturnValue({ from: selectFrom });

  return {
    insert: mockDbInsert,
    update: mockDbUpdate,
    select: mockDbSelect,
  } as unknown as Database;
}

const fakeEventRow = {
  id: 'row-uuid',
  stripeEventId: 'evt_dup',
  eventType: 'unknown.event',
  processingStatus: 'received' as const,
  payload: {},
  errorMessage: null,
  receivedAt: new Date(),
  processedAt: null,
  createdAt: new Date(),
};

const unknownEvent = {
  id: 'evt_unknown',
  type: 'unknown.event.type',
  data: { object: {} },
} as unknown as Stripe.Event;

describe('handleStripeEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns early and skips all updates when the event is a duplicate', async () => {
    const db = makeDb([]);
    await handleStripeEvent(unknownEvent, db);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('calls update twice (processing → processed) on success', async () => {
    const db = makeDb([fakeEventRow]);
    await handleStripeEvent(unknownEvent, db);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    const firstSetArg = mockDbUpdate.mock.results[0]?.value.set.mock.calls[0]?.[0];
    expect(firstSetArg?.processingStatus).toBe('processing');
    const secondSetArg = mockDbUpdate.mock.results[1]?.value.set.mock.calls[0]?.[0];
    expect(secondSetArg?.processingStatus).toBe('processed');
    expect(secondSetArg?.processedAt).toBeInstanceOf(Date);
  });

  it('marks event failed and rethrows when dispatch throws', async () => {
    const db = makeDb([fakeEventRow]);

    const selectLimit = vi.fn().mockRejectedValue(new Error('DB boom'));
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere, limit: selectLimit });
    mockDbSelect.mockReturnValue({ from: selectFrom });

    const subEvent = {
      id: 'evt_sub',
      type: 'customer.subscription.updated',
      data: {
        object: { id: 'sub_123', customer: 'cus_123', status: 'active', items: { data: [] } },
      },
    } as unknown as Stripe.Event;

    await expect(handleStripeEvent(subEvent, db)).rejects.toThrow('DB boom');

    const lastSetArg = mockDbUpdate.mock.results.at(-1)?.value.set.mock.calls[0]?.[0];
    expect(lastSetArg?.processingStatus).toBe('failed');
    expect(lastSetArg?.errorMessage).toBe('DB boom');
  });

  describe('dispatch scenarios', () => {
    const fakeBillingCustomer = {
      id: 'bc-uuid',
      organizationId: 'org-uuid',
      stripeCustomerId: 'cus_123',
    };

    function overrideSelectWithBillingCustomer() {
      const selectLimit = vi.fn().mockResolvedValue([fakeBillingCustomer]);
      const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
      const selectFrom = vi.fn().mockReturnValue({ where: selectWhere, limit: selectLimit });
      mockDbSelect.mockReturnValue({ from: selectFrom });
    }

    function overrideInsertForSubscriptionUpsert() {
      mockDbInsert.mockImplementation(() => {
        const returning = vi.fn().mockResolvedValue([fakeEventRow]);
        const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
        const onConflictDoUpdate = vi.fn().mockResolvedValue({});
        const values = vi.fn().mockReturnValue({ onConflictDoNothing, onConflictDoUpdate });
        return { values };
      });
    }

    it('Scenario A: checkout.session.completed with non-subscription mode does NOT retrieve subscription', async () => {
      const db = makeDb([fakeEventRow]);
      const event = {
        id: 'evt_checkout',
        type: 'checkout.session.completed',
        data: { object: { mode: 'payment', subscription: null } },
      } as unknown as Stripe.Event;

      await handleStripeEvent(event, db);

      expect(mockStripeRetrieve).not.toHaveBeenCalled();
    });

    it('Scenario B: customer.subscription.created happy path upserts subscription', async () => {
      const db = makeDb([fakeEventRow]);
      overrideInsertForSubscriptionUpsert();
      overrideSelectWithBillingCustomer();
      mockMapStripePriceToPlan.mockResolvedValue({ id: 'plan-pro' });

      const event = {
        id: 'evt_sub_created',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_abc',
            customer: 'cus_123',
            status: 'active',
            cancel_at_period_end: false,
            canceled_at: null,
            ended_at: null,
            trial_end: null,
            items: {
              data: [
                {
                  price: { id: 'price_pro' },
                  current_period_start: 1700000000,
                  current_period_end: 1702592000,
                },
              ],
            },
          },
        },
      } as unknown as Stripe.Event;

      await expect(handleStripeEvent(event, db)).resolves.toBeUndefined();

      expect(mockDbInsert).toHaveBeenCalledTimes(2);
    });

    it('Scenario C: customer.subscription.deleted marks subscription as canceled', async () => {
      const db = makeDb([fakeEventRow]);
      const event = {
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_abc',
            canceled_at: 1700000000,
            ended_at: 1700000001,
          },
        },
      } as unknown as Stripe.Event;

      await handleStripeEvent(event, db);

      const updateSetArgs = mockDbUpdate.mock.results.map((r) => r.value.set.mock.calls[0]?.[0]);
      const canceledUpdate = updateSetArgs.find((arg) => arg?.status === 'canceled');
      expect(canceledUpdate?.status).toBe('canceled');
    });

    it('Scenario D: invoice.payment_failed marks subscription as past_due', async () => {
      const db = makeDb([fakeEventRow]);
      const event = {
        id: 'evt_invoice_failed',
        type: 'invoice.payment_failed',
        data: {
          object: {
            parent: {
              subscription_details: { subscription: 'sub_abc' },
            },
          },
        },
      } as unknown as Stripe.Event;

      await handleStripeEvent(event, db);

      const updateSetArgs = mockDbUpdate.mock.results.map((r) => r.value.set.mock.calls[0]?.[0]);
      const pastDueUpdate = updateSetArgs.find((arg) => arg?.status === 'past_due');
      expect(pastDueUpdate?.status).toBe('past_due');
    });

    it('Scenario E: invoice.payment_succeeded marks subscription as active', async () => {
      const db = makeDb([fakeEventRow]);
      const event = {
        id: 'evt_invoice_succeeded',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            parent: {
              subscription_details: { subscription: 'sub_abc' },
            },
          },
        },
      } as unknown as Stripe.Event;

      await handleStripeEvent(event, db);

      const updateSetArgs = mockDbUpdate.mock.results.map((r) => r.value.set.mock.calls[0]?.[0]);
      const activeUpdate = updateSetArgs.find((arg) => arg?.status === 'active');
      expect(activeUpdate?.status).toBe('active');
      expect(and).toHaveBeenCalled();
    });

    it('Scenario F: customer.subscription.updated with unrecognized status throws and marks failed', async () => {
      const db = makeDb([fakeEventRow]);
      overrideInsertForSubscriptionUpsert();
      overrideSelectWithBillingCustomer();
      mockMapStripePriceToPlan.mockResolvedValue({ id: 'plan-pro' });

      const event = {
        id: 'evt_sub_paused',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_abc',
            customer: 'cus_123',
            status: 'paused',
            cancel_at_period_end: false,
            canceled_at: null,
            ended_at: null,
            trial_end: null,
            items: {
              data: [
                {
                  price: { id: 'price_pro' },
                  current_period_start: 1700000000,
                  current_period_end: 1702592000,
                },
              ],
            },
          },
        },
      } as unknown as Stripe.Event;

      await expect(handleStripeEvent(event, db)).rejects.toThrow(
        'Unrecognized Stripe subscription status: paused',
      );

      const lastSetArg = mockDbUpdate.mock.results.at(-1)?.value.set.mock.calls[0]?.[0];
      expect(lastSetArg?.processingStatus).toBe('failed');
    });
  });
});
