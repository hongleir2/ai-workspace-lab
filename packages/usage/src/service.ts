import type { Database, NewUsageEvent, UsageCounter, UsageEvent } from '@ai-workspace-lab/db';
import { and, asc, db, eq, sql, usageCounters, usageEvents } from '@ai-workspace-lab/db';
import { createLogger } from '@ai-workspace-lab/logger';

const logger = createLogger('usage/service');

export type BillingPeriodInput = {
  start: Date;
  end: Date;
};

export type RecordUsageEventInput = NewUsageEvent;

export type RecordUsageEventResult = { inserted: true; event: UsageEvent } | { inserted: false };

export type IncrementUsageCounterArgs = {
  organizationId: string;
  featureKey: string;
  periodStart: Date;
  periodEnd: Date;
  /** Numeric string; added to `used_quantity` on conflict */
  delta: string;
  limitQuantity?: string | null;
};

export type RecordUsageWithCounterArgs = {
  event: RecordUsageEventInput;
  period: BillingPeriodInput;
  /** Defaults to stringified `event.quantity` */
  delta?: string;
  limitQuantity?: string | null;
};

type UsageDb = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export async function recordUsageEvent(
  input: RecordUsageEventInput,
  dbConn: UsageDb = db,
): Promise<RecordUsageEventResult> {
  const rows = await dbConn
    .insert(usageEvents)
    .values(input)
    .onConflictDoNothing({ target: usageEvents.idempotencyKey })
    .returning();

  const row = rows[0];
  if (row) {
    return { inserted: true, event: row };
  }
  return { inserted: false };
}

export async function incrementUsageCounter(
  args: IncrementUsageCounterArgs,
  dbConn: UsageDb = db,
): Promise<void> {
  await dbConn
    .insert(usageCounters)
    .values({
      organizationId: args.organizationId,
      featureKey: args.featureKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      usedQuantity: args.delta,
      limitQuantity: args.limitQuantity ?? null,
    })
    .onConflictDoUpdate({
      target: [
        usageCounters.organizationId,
        usageCounters.featureKey,
        usageCounters.periodStart,
        usageCounters.periodEnd,
      ],
      set: {
        usedQuantity: sql`${usageCounters.usedQuantity}::numeric + ${args.delta}::numeric`,
      },
    });
}

export async function getUsageForFeature(
  organizationId: string,
  featureKey: string,
  period: BillingPeriodInput,
  dbConn: UsageDb = db,
): Promise<UsageCounter | null> {
  const rows = await dbConn
    .select()
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.organizationId, organizationId),
        eq(usageCounters.featureKey, featureKey),
        eq(usageCounters.periodStart, period.start),
        eq(usageCounters.periodEnd, period.end),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getUsageSummaryForOrganization(
  organizationId: string,
  dbConn: UsageDb = db,
): Promise<UsageCounter[]> {
  return dbConn
    .select()
    .from(usageCounters)
    .where(eq(usageCounters.organizationId, organizationId))
    .orderBy(asc(usageCounters.featureKey), asc(usageCounters.periodStart));
}

/**
 * Record a usage event and increment the counter in a single transaction.
 *
 * Pass the root `db` singleton (default) — do NOT pass a transaction client as
 * `dbConn`. postgres.js wraps nested `.transaction()` calls in savepoints, which
 * means a rollback in the outer transaction will not reliably roll back this one.
 * Callers that need to compose with an outer transaction should call
 * `recordUsageEvent` + `incrementUsageCounter` directly inside their own tx.
 */
export async function recordUsageWithCounter(
  args: RecordUsageWithCounterArgs,
  dbConn: UsageDb = db,
): Promise<RecordUsageEventResult> {
  return dbConn.transaction(async (tx) => {
    const result = await recordUsageEvent(args.event, tx);
    if (result.inserted) {
      logger.info('usage.recorded', {
        orgId: args.event.organizationId,
        featureKey: args.event.featureKey,
        idempotencyKey: args.event.idempotencyKey,
        quantity: args.event.quantity,
      });
      const delta = args.delta ?? String(args.event.quantity);
      const counterArgs: IncrementUsageCounterArgs = {
        organizationId: args.event.organizationId,
        featureKey: args.event.featureKey,
        periodStart: args.period.start,
        periodEnd: args.period.end,
        delta,
      };
      if (args.limitQuantity !== undefined) {
        counterArgs.limitQuantity = args.limitQuantity;
      }
      await incrementUsageCounter(counterArgs, tx);
    } else {
      logger.info('usage.deduplicated', {
        orgId: args.event.organizationId,
        featureKey: args.event.featureKey,
        idempotencyKey: args.event.idempotencyKey,
      });
    }
    return result;
  });
}
