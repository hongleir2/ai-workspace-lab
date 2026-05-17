'use client';

import { identifyOrganization, identifyUser } from '@ai-workspace-lab/analytics';
import { useEffect } from 'react';

interface AnalyticsIdentityProps {
  userId: string;
  orgId: string;
  orgSlug: string;
}

export function AnalyticsIdentity({ userId, orgId, orgSlug }: AnalyticsIdentityProps) {
  useEffect(() => {
    identifyUser(userId);
    identifyOrganization(orgId, orgSlug);
  }, [userId, orgId, orgSlug]);

  return null;
}
