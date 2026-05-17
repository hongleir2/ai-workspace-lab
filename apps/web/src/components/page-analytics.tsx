'use client';

import { captureEvent } from '@ai-workspace-lab/analytics';
import { useEffect } from 'react';

interface PageAnalyticsProps {
  event: string;
  properties?: Record<string, unknown>;
}

export function PageAnalytics({ event, properties }: PageAnalyticsProps) {
  // Only re-fire when the event name changes (page navigation).
  // `properties` is a new object each render; including it would cause infinite re-fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    captureEvent(event, properties);
  }, [event]);

  return null;
}
