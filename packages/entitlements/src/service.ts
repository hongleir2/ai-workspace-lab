import {
  type Database,
  type Plan,
  type PlanLimit,
  type Subscription,
  and,
  db,
  eq,
  inArray,
  planLimits,
  plans,
  subscriptions,
  usageCounters,
} from '@ai-workspace-lab/db';
import { createLogger } from '@ai-workspace-lab/logger';
import { EntitlementError } from './errors';
import { type BillingPeriod, getCurrentBillingPeriod } from './period';

const logger = createLogger('entitlements/service');

export async function getOrganizationPlan(
  organizationId: string,
  dbConn: Database = db,
): Promise<{ subscription: Subscription; plan: Plan }> {
  const rows = await dbConn
    .select({ subscription: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        inArray(subscriptions.status, ['active', 'trialing', 'free']),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    logger.warn('subscription.not_found', { orgId: organizationId });
    throw new EntitlementError('NO_ACTIVE_SUBSCRIPTION');
  }
  return row;
}

export async function getPlanLimits(
  planId: string,
  featureKey?: string,
  dbConn: Database = db,
): Promise<PlanLimit[]> {
  const condition = featureKey
    ? and(eq(planLimits.planId, planId), eq(planLimits.featureKey, featureKey))
    : eq(planLimits.planId, planId);

  return dbConn.select().from(planLimits).where(condition);
}

export async function checkEntitlement(
  organizationId: string,
  featureKey: string,
  dbConn: Database = db,
): Promise<boolean> {
  const { subscription } = await getOrganizationPlan(organizationId, dbConn);
  const limits = await getPlanLimits(subscription.planId, featureKey, dbConn);
  return limits.length > 0;
}

export async function getUsedQuantityInPeriod(
  organizationId: string,
  featureKey: string,
  period: BillingPeriod,
  dbConn: Database = db,
): Promise<number> {
  const rows = await dbConn
    .select({ usedQuantity: usageCounters.usedQuantity })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.organizationId, organizationId),
        eq(usageCounters.featureKey, featureKey),
        eq(usageCounters.periodStart, period.start),
        eq(usageCounters.periodEnd, period.end),
      ),
    );
  return rows[0] ? Number(rows[0].usedQuantity) : 0;
}

export async function checkQuota(
  organizationId: string,
  featureKey: string,
  dbConn: Database = db,
): Promise<boolean> {
  const { subscription } = await getOrganizationPlan(organizationId, dbConn);
  const limits = await getPlanLimits(subscription.planId, featureKey, dbConn);
  const limit = limits[0];

  if (!limit) return false;
  if (limit.limitValue === null) return true;
  if (limit.resetInterval === 'none') return true;

  const period = getCurrentBillingPeriod(subscription, limit.resetInterval);
  if (!period) return true;

  const used = await getUsedQuantityInPeriod(organizationId, featureKey, period, dbConn);
  return used < limit.limitValue;
}

export async function assertFeatureAllowed(
  organizationId: string,
  featureKey: string,
  dbConn: Database = db,
): Promise<void> {
  const { subscription } = await getOrganizationPlan(organizationId, dbConn);
  const limits = await getPlanLimits(subscription.planId, featureKey, dbConn);
  const limit = limits[0];

  if (!limit) {
    logger.warn('feature.not_included', {
      orgId: organizationId,
      featureKey,
      planId: subscription.planId,
    });
    throw new EntitlementError('FEATURE_NOT_INCLUDED');
  }
  if (limit.limitValue === null || limit.resetInterval === 'none') return;

  const period = getCurrentBillingPeriod(subscription, limit.resetInterval);
  if (!period) return;

  const used = await getUsedQuantityInPeriod(organizationId, featureKey, period, dbConn);
  if (used >= limit.limitValue) {
    logger.warn('quota.exceeded', {
      orgId: organizationId,
      featureKey,
      used,
      limit: limit.limitValue,
    });
    throw new EntitlementError('QUOTA_EXCEEDED');
  }
}
