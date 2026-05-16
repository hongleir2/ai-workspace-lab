import { beforeEach, describe, expect, it, vi } from 'vitest';

// Guards and billing service are the trust boundary — mock both so we can
// verify that the owner-only gate fires before any Stripe call is made.
const { mockRequireRole, mockCreateCheckoutSession, mockCreateBillingPortalSession, mockRedirect } =
  vi.hoisted(() => ({
    mockRequireRole: vi.fn(),
    mockCreateCheckoutSession: vi.fn(),
    mockCreateBillingPortalSession: vi.fn(),
    mockRedirect: vi.fn(),
  }));

vi.mock('@/lib/orgs/guards', () => ({ requireRole: mockRequireRole }));
vi.mock('@ai-workspace-lab/billing', () => ({
  createCheckoutSession: mockCreateCheckoutSession,
  createBillingPortalSession: mockCreateBillingPortalSession,
}));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_APP_URL: 'https://app.example.com' },
}));

import { openBillingPortalAction, startCheckoutAction } from './actions';

describe('startCheckoutAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls requireRole before creating a checkout session', async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: 'u1', email: 'owner@example.com' },
      organization: { id: 'org1', name: 'Acme' },
    });
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/pay/cs_test');
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(startCheckoutAction('price_abc', 'acme')).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRequireRole).toHaveBeenCalledWith('acme', ['owner']);
    expect(mockCreateCheckoutSession).toHaveBeenCalledOnce();
  });

  it('does not call createCheckoutSession when requireRole rejects', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden'));

    await expect(startCheckoutAction('price_abc', 'acme')).rejects.toThrow('Forbidden');
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });
});

describe('openBillingPortalAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls requireRole before opening the portal', async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: 'u1', email: 'owner@example.com' },
      organization: { id: 'org1', name: 'Acme' },
    });
    mockCreateBillingPortalSession.mockResolvedValue('https://billing.stripe.com/session/xxx');
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(openBillingPortalAction('acme')).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRequireRole).toHaveBeenCalledWith('acme', ['owner']);
    expect(mockCreateBillingPortalSession).toHaveBeenCalledOnce();
  });

  it('does not call createBillingPortalSession when requireRole rejects', async () => {
    mockRequireRole.mockRejectedValue(new Error('Forbidden'));

    await expect(openBillingPortalAction('acme')).rejects.toThrow('Forbidden');
    expect(mockCreateBillingPortalSession).not.toHaveBeenCalled();
  });
});
