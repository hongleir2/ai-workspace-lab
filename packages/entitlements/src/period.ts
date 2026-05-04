import type { Subscription } from '@ai-workspace-lab/db';

export interface BillingPeriod {
  start: Date;
  end: Date;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export function getCurrentBillingPeriod(
  subscription: Subscription,
  resetInterval: 'day' | 'month' | 'billing_period' | 'none',
): BillingPeriod | null {
  const now = new Date();

  switch (resetInterval) {
    case 'none':
      return null;
    case 'day':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'billing_period':
      if (subscription.currentPeriodStart && subscription.currentPeriodEnd) {
        return {
          start: subscription.currentPeriodStart,
          end: subscription.currentPeriodEnd,
        };
      }
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}
