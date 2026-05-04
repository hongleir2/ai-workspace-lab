import type { Plan } from '@ai-workspace-lab/db';
import {
  EntitlementError,
  type UsageOverviewLine,
  getOrganizationUsageOverview,
} from '@ai-workspace-lab/entitlements';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMembership } from '@/lib/orgs/guards';

export const dynamic = 'force-dynamic';

interface UsagePageProps {
  params: Promise<{ orgSlug: string }>;
}

function billingIntervalLabel(interval: Plan['billingInterval']): string {
  switch (interval) {
    case 'none':
      return 'No paid billing cycle';
    case 'month':
      return 'Billed monthly';
    case 'year':
      return 'Billed annually';
  }
}

function formatPeriodRange(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function formatFeatureValue(line: UsageOverviewLine): { primary: string; detail: string | null } {
  if (line.unlimited) {
    return { primary: 'Unlimited', detail: null };
  }
  if (line.limitUnit === 'mb') {
    return {
      primary: `${line.limit ?? '—'} MB`,
      detail: 'Maximum size per uploaded file.',
    };
  }
  if (line.limitUnit === 'count' && line.used !== null && line.limit !== null) {
    return {
      primary: `${line.used} / ${line.limit}`,
      detail: line.resetSummary,
    };
  }
  return {
    primary: line.limit !== null ? String(line.limit) : '—',
    detail: line.resetSummary,
  };
}

export default async function UsagePage({ params }: UsagePageProps) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);

  let overview: Awaited<ReturnType<typeof getOrganizationUsageOverview>>;
  try {
    overview = await getOrganizationUsageOverview(organization.id);
  } catch (err) {
    if (err instanceof EntitlementError && err.code === 'NO_ACTIVE_SUBSCRIPTION') {
      return (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{'Usage'}</h1>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{'No active plan'}</CardTitle>
              <CardDescription>
                {
                  'We could not find an active subscription for this organization. Contact support or complete billing setup.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="cursor-pointer">
                <Link href={`/app/${orgSlug}/billing`}>{'Open billing'}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    throw err;
  }

  const billingRange = formatPeriodRange(
    overview.subscription.currentPeriodStart,
    overview.subscription.currentPeriodEnd,
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{'Usage'}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {
              'Plan limits and consumption for this workspace. Detailed AI and document breakdowns will ship in later sprints.'
            }
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit shrink-0 cursor-pointer">
          <Link href={`/app/${orgSlug}/billing`}>
            {'Upgrade plan'}
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{'Current plan'}</CardTitle>
            <CardDescription>{'Subscription tier for this organization.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold">{overview.plan.name}</p>
            <p className="text-sm text-muted-foreground">
              {billingIntervalLabel(overview.plan.billingInterval)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{'Billing & reset window'}</CardTitle>
            <CardDescription>
              {
                'Paid subscriptions follow Stripe billing periods. Metered limits reset on the schedule shown per feature.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {billingRange ? (
              <>
                <p className="font-medium text-foreground">{'Current subscription period'}</p>
                <p className="text-muted-foreground">{billingRange}</p>
              </>
            ) : (
              <p className="text-muted-foreground">
                {
                  'No Stripe billing period on file. Free and calendar-based limits reset on the schedule below.'
                }
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {overview.lines.map((line) => {
          const { primary, detail } = formatFeatureValue(line);
          const showBar = line.percentUsed !== null;

          return (
            <Card key={line.featureKey}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{line.title}</CardTitle>
                {detail ? <CardDescription>{detail}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-semibold tabular-nums tracking-tight">{primary}</p>
                {line.periodStart && line.periodEnd ? (
                  <p className="text-xs text-muted-foreground">
                    {`Counts toward period: ${formatPeriodRange(line.periodStart, line.periodEnd)}`}
                  </p>
                ) : null}
                {showBar ? (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${line.percentUsed}%` }}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">{'Need higher limits?'}</CardTitle>
          <CardDescription>
            {
              'Upgrade flows will connect to Stripe Checkout in the billing sprint. This button goes to the billing hub placeholder.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="cursor-pointer">
            <Link href={`/app/${orgSlug}/billing`}>
              {'View billing & upgrades'}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
