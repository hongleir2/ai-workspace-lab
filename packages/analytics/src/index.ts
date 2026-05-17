'use client';

import posthog from 'posthog-js';

function isClient(): boolean {
  return typeof window !== 'undefined';
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (!isClient()) return;
  posthog.identify(userId, properties);
}

export function identifyOrganization(
  orgId: string,
  orgSlug: string,
  properties?: Record<string, unknown>,
): void {
  if (!isClient()) return;
  posthog.group('organization', orgId, { slug: orgSlug, ...properties });
}

export function captureEvent(event: string, properties?: Record<string, unknown>): void {
  if (!isClient()) return;
  posthog.capture(event, properties);
}

export function resetAnalytics(): void {
  if (!isClient()) return;
  posthog.reset();
}

export function trackCheckoutStarted(orgSlug: string, priceId: string): void {
  captureEvent('checkout_started', { org_slug: orgSlug, price_id: priceId });
}

export function trackCheckoutSuccessViewed(orgSlug: string): void {
  captureEvent('checkout_success_viewed', { org_slug: orgSlug });
}

export function trackCheckoutCanceled(orgSlug: string): void {
  captureEvent('checkout_canceled', { org_slug: orgSlug });
}

export function trackBillingPortalOpened(orgSlug: string): void {
  captureEvent('billing_portal_opened', { org_slug: orgSlug });
}
