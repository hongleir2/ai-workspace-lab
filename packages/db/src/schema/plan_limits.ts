import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { plans } from './plans';

export const limitUnitEnum = pgEnum('limit_unit', ['count', 'mb', 'tokens', 'seats', 'bytes']);
export const resetIntervalEnum = pgEnum('reset_interval', [
  'day',
  'month',
  'billing_period',
  'none',
]);

export const planLimits = pgTable(
  'plan_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id),
    featureKey: text('feature_key').notNull(),
    limitValue: integer('limit_value'),
    limitUnit: limitUnitEnum('limit_unit').notNull(),
    resetInterval: resetIntervalEnum('reset_interval').notNull(),
    hardLimit: boolean('hard_limit').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('plan_limits_plan_feature_unique').on(t.planId, t.featureKey),
    index('plan_limits_feature_key_idx').on(t.featureKey),
  ],
);

export type PlanLimit = typeof planLimits.$inferSelect;
export type NewPlanLimit = typeof planLimits.$inferInsert;
