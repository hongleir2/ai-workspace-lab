'use client';

import { trackCheckoutCanceled, trackCheckoutSuccessViewed } from '@ai-workspace-lab/analytics';
import { useEffect } from 'react';

type BillingEvent = 'checkout_success' | 'checkout_canceled';

interface BillingEventTrackerProps {
  event: BillingEvent;
  orgSlug: string;
}

export function BillingEventTracker({ event, orgSlug }: BillingEventTrackerProps) {
  useEffect(() => {
    if (event === 'checkout_success') {
      trackCheckoutSuccessViewed(orgSlug);
    } else {
      trackCheckoutCanceled(orgSlug);
    }
  }, [event, orgSlug]);

  return null;
}
