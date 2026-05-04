import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const usageUnitEnum = pgEnum('usage_unit', ['count', 'tokens', 'bytes', 'micro_usd']);

export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id),
    featureKey: text('feature_key').notNull(),
    eventType: text('event_type').notNull(),
    quantity: numeric('quantity').notNull(),
    unit: usageUnitEnum('unit').notNull(),
    provider: text('provider'),
    modelName: text('model_name'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    costMicroUsd: bigint('cost_micro_usd', { mode: 'number' }),
    sourceType: text('source_type'),
    sourceId: uuid('source_id'),
    idempotencyKey: text('idempotency_key'),
    metadata: jsonb('metadata'),
    billingPeriodStart: timestamp('billing_period_start', { withTimezone: true }),
    billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('usage_events_idempotency_key_unique').on(t.idempotencyKey),
    index('usage_events_org_created_idx').on(t.organizationId, t.createdAt),
    index('usage_events_org_feature_created_idx').on(t.organizationId, t.featureKey, t.createdAt),
    index('usage_events_user_created_idx').on(t.userId, t.createdAt),
  ],
);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
