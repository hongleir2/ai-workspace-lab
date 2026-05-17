'use client';

import { captureEvent } from '@ai-workspace-lab/analytics';
import { useEffect, useRef } from 'react';

interface PageAnalyticsProps {
  event: string;
  properties?: Record<string, unknown>;
}

export function PageAnalytics({ event, properties }: PageAnalyticsProps) {
  const propertiesRef = useRef(properties);
  useEffect(() => {
    captureEvent(event, propertiesRef.current);
  }, [event]);

  return null;
}
