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

    // Override select AFTER makeDb so the rejection applies during dispatch
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
});
