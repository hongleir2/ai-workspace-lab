// PostHog wiring deferred to the analytics sprint.
export function trackCheckoutStarted(_orgSlug: string, _priceId: string): void {}
export function trackCheckoutSuccessViewed(_orgSlug: string): void {}
export function trackCheckoutCanceled(_orgSlug: string): void {}
export function trackBillingPortalOpened(_orgSlug: string): void {}
