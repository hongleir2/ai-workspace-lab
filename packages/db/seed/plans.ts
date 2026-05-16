import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { planLimits, plans } from '../src/schema/index';

const PLAN_DATA = [
  {
    id: 'free',
    name: 'Free',
    billingInterval: 'none' as const,
    priceCents: 0,
    currency: 'usd',
    stripePriceId: null,
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'pro_monthly',
    name: 'Pro (Monthly)',
    billingInterval: 'month' as const,
    priceCents: 2000,
    currency: 'usd',
    stripePriceId: process.env['STRIPE_PRO_MONTHLY_PRICE_ID'] ?? null,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'pro_yearly',
    name: 'Pro (Yearly)',
    billingInterval: 'year' as const,
    priceCents: 20000,
    currency: 'usd',
    stripePriceId: process.env['STRIPE_PRO_YEARLY_PRICE_ID'] ?? null,
    isActive: true,
    sortOrder: 2,
  },
];

const LIMIT_DATA = [
  // free
  {
    planId: 'free',
    featureKey: 'ai_messages',
    limitValue: 10,
    limitUnit: 'count' as const,
    resetInterval: 'day' as const,
    hardLimit: true,
  },
  {
    planId: 'free',
    featureKey: 'document_uploads',
    limitValue: 3,
    limitUnit: 'count' as const,
    resetInterval: 'day' as const,
    hardLimit: true,
  },
  {
    planId: 'free',
    featureKey: 'max_file_size_mb',
    limitValue: 5,
    limitUnit: 'mb' as const,
    resetInterval: 'none' as const,
    hardLimit: true,
  },
  // pro_monthly
  {
    planId: 'pro_monthly',
    featureKey: 'ai_messages',
    limitValue: 500,
    limitUnit: 'count' as const,
    resetInterval: 'billing_period' as const,
    hardLimit: true,
  },
  {
    planId: 'pro_monthly',
    featureKey: 'document_uploads',
    limitValue: 100,
    limitUnit: 'count' as const,
    resetInterval: 'billing_period' as const,
    hardLimit: true,
  },
  {
    planId: 'pro_monthly',
    featureKey: 'max_file_size_mb',
    limitValue: 50,
    limitUnit: 'mb' as const,
    resetInterval: 'none' as const,
    hardLimit: true,
  },
  // pro_yearly — same limits as pro_monthly
  {
    planId: 'pro_yearly',
    featureKey: 'ai_messages',
    limitValue: 500,
    limitUnit: 'count' as const,
    resetInterval: 'billing_period' as const,
    hardLimit: true,
  },
  {
    planId: 'pro_yearly',
    featureKey: 'document_uploads',
    limitValue: 100,
    limitUnit: 'count' as const,
    resetInterval: 'billing_period' as const,
    hardLimit: true,
  },
  {
    planId: 'pro_yearly',
    featureKey: 'max_file_size_mb',
    limitValue: 50,
    limitUnit: 'mb' as const,
    resetInterval: 'none' as const,
    hardLimit: true,
  },
] as const;

// biome-ignore lint/suspicious/noExplicitAny: seed runner uses generic drizzle instance without full schema types
export async function seedPlans(db: PostgresJsDatabase<any>): Promise<void> {
  for (const plan of PLAN_DATA) {
    await db
      .insert(plans)
      .values(plan)
      .onConflictDoUpdate({
        target: plans.id,
        set: {
          name: plan.name,
          billingInterval: plan.billingInterval,
          priceCents: plan.priceCents,
          stripePriceId: plan.stripePriceId,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
        },
      });
  }
  console.log(`Seeded ${PLAN_DATA.length} plans`);

  for (const limit of LIMIT_DATA) {
    await db
      .insert(planLimits)
      .values(limit)
      .onConflictDoUpdate({
        target: [planLimits.planId, planLimits.featureKey],
        set: {
          limitValue: limit.limitValue,
          limitUnit: limit.limitUnit,
          resetInterval: limit.resetInterval,
          hardLimit: limit.hardLimit,
        },
      });
  }
  console.log(`Seeded ${LIMIT_DATA.length} plan limits`);
}
