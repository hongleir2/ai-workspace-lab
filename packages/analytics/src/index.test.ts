import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCapture, mockIdentify, mockGroup, mockReset } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockIdentify: vi.fn(),
  mockGroup: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: { capture: mockCapture, identify: mockIdentify, group: mockGroup, reset: mockReset },
}));

Object.defineProperty(globalThis, 'window', { value: {}, writable: true });

import {
  captureEvent,
  identifyOrganization,
  identifyUser,
  resetAnalytics,
  trackBillingPortalOpened,
  trackCheckoutCanceled,
  trackCheckoutStarted,
  trackCheckoutSuccessViewed,
} from './index';

describe('analytics wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('captureEvent calls posthog.capture with event + props', () => {
    captureEvent('test_event', { foo: 'bar' });
    expect(mockCapture).toHaveBeenCalledWith('test_event', { foo: 'bar' });
  });

  it('captureEvent is a no-op when window is undefined', () => {
    const original = (globalThis as Record<string, unknown>)['window'];
    Object.defineProperty(globalThis, 'window', { value: undefined, writable: true });
    captureEvent('test_event');
    expect(mockCapture).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'window', { value: original, writable: true });
  });

  it('identifyUser calls posthog.identify', () => {
    identifyUser('user-123', { email: 'a@b.com' });
    expect(mockIdentify).toHaveBeenCalledWith('user-123', { email: 'a@b.com' });
  });

  it('identifyOrganization calls posthog.group', () => {
    identifyOrganization('org-456', 'acme', { plan: 'free' });
    expect(mockGroup).toHaveBeenCalledWith('organization', 'org-456', {
      slug: 'acme',
      plan: 'free',
    });
  });

  it('resetAnalytics calls posthog.reset', () => {
    resetAnalytics();
    expect(mockReset).toHaveBeenCalled();
  });

  it('trackCheckoutStarted captures checkout_started', () => {
    trackCheckoutStarted('acme', 'price_123');
    expect(mockCapture).toHaveBeenCalledWith('checkout_started', {
      org_slug: 'acme',
      price_id: 'price_123',
    });
  });

  it('trackCheckoutSuccessViewed captures checkout_success_viewed', () => {
    trackCheckoutSuccessViewed('acme');
    expect(mockCapture).toHaveBeenCalledWith('checkout_success_viewed', { org_slug: 'acme' });
  });

  it('trackCheckoutCanceled captures checkout_canceled', () => {
    trackCheckoutCanceled('acme');
    expect(mockCapture).toHaveBeenCalledWith('checkout_canceled', { org_slug: 'acme' });
  });

  it('trackBillingPortalOpened captures billing_portal_opened', () => {
    trackBillingPortalOpened('acme');
    expect(mockCapture).toHaveBeenCalledWith('billing_portal_opened', { org_slug: 'acme' });
  });
});
