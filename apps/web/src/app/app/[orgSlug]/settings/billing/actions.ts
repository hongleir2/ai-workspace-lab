'use server';

'use server';

import { appUrl } from '@/lib/env';
import { requireRole } from '@/lib/orgs/guards';
import { createBillingPortalSession, createCheckoutSession } from '@ai-workspace-lab/billing';
import { redirect } from 'next/navigation';

export async function startCheckoutAction(priceId: string, orgSlug: string): Promise<never> {
  const { user, organization } = await requireRole(orgSlug, ['owner']);
  const sessionUrl = await createCheckoutSession(
    organization.id,
    priceId,
    orgSlug,
    organization.name,
    user.email,
    user.id,
    appUrl(),
  );
  redirect(sessionUrl);
}

export async function openBillingPortalAction(orgSlug: string): Promise<never> {
  const { organization } = await requireRole(orgSlug, ['owner']);
  const portalUrl = await createBillingPortalSession(organization.id, orgSlug, appUrl());
  redirect(portalUrl);
}
