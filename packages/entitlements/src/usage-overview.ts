import type { Database, Plan, PlanLimit, Subscription } from '@ai-workspace-lab/db';
import { db } from '@ai-workspace-lab/db';
import { getCurrentBillingPeriod } from './period';
import { getOrganizationPlan, getPlanLimits, getUsedQuantityInPeriod } from './service';

const FEATURE_DISPLAY_ORDER = ['ai_messages', 'document_uploads', 'max_file_size_mb'] as const;

export type UsageOverviewLine = {
  featureKey: string;
  title: string;
  used: number | null;
  limit: number | null;
  limitUnit: PlanLimit['limitUnit'];
  unlimited: boolean;
  resetInterval: PlanLimit['resetInterval'];
  resetSummary: string;
  periodStart: string | null;
  periodEnd: string | null;
  percentUsed: number | null;
};

export type OrganizationUsageOverview = {
  plan: { id: string; name: string; billingInterval: Plan['billingInterval'] };
  subscription: {
    status: Subscription['status'];
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  lines: UsageOverviewLine[];
};

function titleForFeature(featureKey: string): string {
  switch (featureKey) {
    case 'ai_messages':
      return 'AI messages';
    case 'document_uploads':
      return 'Document uploads';
    case 'max_file_size_mb':
      return 'Max file size';
    default:
      return featureKey.replaceAll('_', ' ');
  }
}

function resetSummary(interval: PlanLimit['resetInterval']): string {
  switch (interval) {
    case 'day':
      return 'Resets daily';
    case 'month':
      return 'Resets monthly';
    case 'billing_period':
      return 'Resets each billing period';
    case 'none':
      return 'Static limit';
  }
}

function sortLimits(limits: PlanLimit[]): PlanLimit[] {
  const order = new Map<string, number>(FEATURE_DISPLAY_ORDER.map((k, i) => [k, i]));
  return [...limits].sort((a, b) => {
    const ai = order.get(a.featureKey) ?? 99;
    const bi = order.get(b.featureKey) ?? 99;
    if (ai !== bi) return ai - bi;
    return a.featureKey.localeCompare(b.featureKey);
  });
}

export async function getOrganizationUsageOverview(
  organizationId: string,
  dbConn: Database = db,
): Promise<OrganizationUsageOverview> {
  const { subscription, plan } = await getOrganizationPlan(organizationId, dbConn);
  const limits = sortLimits(await getPlanLimits(plan.id, undefined, dbConn));

  // Compute the applicable period for each limit upfront, then fire all counter
  // queries in parallel to avoid sequential N+1 round-trips.
  const periods = limits.map((limit) =>
    limit.resetInterval === 'none' || limit.limitValue === null
      ? null
      : getCurrentBillingPeriod(subscription, limit.resetInterval),
  );

  const usedCounts = await Promise.all(
    limits.map((limit, i) => {
      const period = periods[i] ?? null;
      if (limit.resetInterval === 'none' || limit.limitValue === null || !period) {
        return Promise.resolve(null);
      }
      return getUsedQuantityInPeriod(organizationId, limit.featureKey, period, dbConn);
    }),
  );

  const lines: UsageOverviewLine[] = limits.map((limit, i) => {
    const period = periods[i] ?? null;
    const used = usedCounts[i] ?? null;
    const unlimited = limit.limitValue === null;
    let percentUsed: number | null = null;
    if (!unlimited && used !== null && limit.limitValue !== null && limit.limitUnit === 'count') {
      percentUsed = Math.min(100, Math.round((used / limit.limitValue) * 100));
    }
    return {
      featureKey: limit.featureKey,
      title: titleForFeature(limit.featureKey),
      used,
      limit: limit.limitValue,
      limitUnit: limit.limitUnit,
      unlimited,
      resetInterval: limit.resetInterval,
      resetSummary: resetSummary(limit.resetInterval),
      periodStart: period?.start.toISOString() ?? null,
      periodEnd: period?.end.toISOString() ?? null,
      percentUsed,
    };
  });

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      billingInterval: plan.billingInterval,
    },
    subscription: {
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    },
    lines,
  };
}
