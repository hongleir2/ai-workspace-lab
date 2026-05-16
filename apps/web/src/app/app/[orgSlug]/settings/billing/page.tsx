import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireMembership } from '@/lib/orgs/guards';
import { db, eq, plans } from '@ai-workspace-lab/db';
import { getOrganizationPlan } from '@ai-workspace-lab/entitlements';
import { CreditCard } from 'lucide-react';
import { ManageBillingButton } from './manage-billing-button';
import { UpgradeButton } from './upgrade-button';

interface Props {
  params: Promise<{ orgSlug: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  free: 'Free',
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past Due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
};

function formatPrice(priceCents: number, interval: string): string {
  if (priceCents === 0) return 'Free';
  const dollars = (priceCents / 100).toFixed(0);
  return interval === 'month' ? `$${dollars}/month` : `$${dollars}/year`;
}

export default async function BillingSettingsPage({ params }: Props) {
  const { orgSlug } = await params;
  const { organization, membership } = await requireMembership(orgSlug);
  const isOwner = membership.role === 'owner';

  const { subscription, plan } = await getOrganizationPlan(organization.id);

  const [monthlyPlan, yearlyPlan] = await Promise.all([
    db
      .select()
      .from(plans)
      .where(eq(plans.id, 'pro_monthly'))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(plans)
      .where(eq(plans.id, 'pro_yearly'))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const isPaidPlan = plan.id !== 'free';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{'Billing'}</CardTitle>
        <CardDescription>{'Your current plan and payment details.'}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{plan.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatPrice(plan.priceCents, plan.billingInterval)}
              </p>
            </div>
          </div>
          <Badge variant={subscription.status === 'past_due' ? 'destructive' : 'secondary'}>
            {STATUS_LABELS[subscription.status] ?? subscription.status}
          </Badge>
        </div>

        {subscription.currentPeriodEnd !== null && (
          <p className="text-sm text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? `Plan ends ${subscription.currentPeriodEnd.toLocaleDateString()}`
              : `Renews ${subscription.currentPeriodEnd.toLocaleDateString()}`}
          </p>
        )}

        {!isOwner && (
          <p className="text-sm text-muted-foreground">
            {'Only the organization owner can manage billing.'}
          </p>
        )}
      </CardContent>

      {isOwner && (
        <CardFooter className="flex gap-3">
          {isPaidPlan ? (
            <ManageBillingButton orgSlug={orgSlug} />
          ) : (
            <>
              {monthlyPlan?.stripePriceId && (
                <UpgradeButton
                  priceId={monthlyPlan.stripePriceId}
                  orgSlug={orgSlug}
                  label={`Upgrade Monthly — $${((monthlyPlan.priceCents ?? 0) / 100).toFixed(0)}/mo`}
                />
              )}
              {yearlyPlan?.stripePriceId && (
                <UpgradeButton
                  priceId={yearlyPlan.stripePriceId}
                  orgSlug={orgSlug}
                  label={`Upgrade Yearly — $${((yearlyPlan.priceCents ?? 0) / 100).toFixed(0)}/yr`}
                />
              )}
            </>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
