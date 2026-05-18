import { AnalyticsIdentity } from '@/components/analytics-identity';
import { AppSidebar } from '@/components/nav/app-sidebar';
import { AppTopbar } from '@/components/nav/app-topbar';
import { FLAGS, getServerFeatureFlag } from '@/lib/analytics/flags';
import { requireMembership } from '@/lib/orgs/guards';
import { getUserOrganizations } from '@/lib/orgs/service';
import { EntitlementError, getOrganizationPlan } from '@ai-workspace-lab/entitlements';
import * as Sentry from '@sentry/nextjs';
import type { ReactNode } from 'react';

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  const { user, organization, membership } = await requireMembership(orgSlug);
  Sentry.setUser({ id: user.id });
  Sentry.setContext('organization', {
    id: organization.id,
    slug: organization.slug,
    role: membership.role,
  });
  const [memberships, planResult, uploadEnabled, aiChatEnabled] = await Promise.all([
    getUserOrganizations(user.id),
    getOrganizationPlan(organization.id).catch((err: unknown) => {
      if (err instanceof EntitlementError && err.code === 'NO_ACTIVE_SUBSCRIPTION') return null;
      throw err;
    }),
    getServerFeatureFlag(FLAGS.DOCUMENT_UPLOAD, user.id),
    getServerFeatureFlag(FLAGS.AI_CHAT, user.id),
  ]);

  const plan = planResult?.plan;
  const subscription = planResult?.subscription;

  const disabledFeatures = new Set<string>();
  if (!uploadEnabled) disabledFeatures.add(FLAGS.DOCUMENT_UPLOAD);
  if (!aiChatEnabled) disabledFeatures.add(FLAGS.AI_CHAT);
  const allOrgs = memberships.map(({ organization: org }) => ({
    slug: org.slug,
    name: org.name,
  }));

  const daysLeft =
    subscription?.status === 'trialing' && subscription.currentPeriodEnd
      ? Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / 86_400_000))
      : undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        orgSlug={orgSlug}
        orgName={organization.name}
        allOrgs={allOrgs}
        planId={plan?.id ?? 'free'}
        planName={plan?.name ?? 'Free'}
        subscriptionStatus={subscription?.status ?? 'free'}
        disabledFeatures={disabledFeatures}
        {...(daysLeft !== undefined ? { daysLeft } : {})}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar orgSlug={orgSlug} userDisplayName={user.displayName} userEmail={user.email} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <AnalyticsIdentity userId={user.id} orgId={organization.id} orgSlug={organization.slug} />
    </div>
  );
}
