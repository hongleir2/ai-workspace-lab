import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { billingCustomers } from './billing_customers';
import { organizations } from './organizations';
import { plans } from './plans';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'free',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
]);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    billingCustomerId: uuid('billing_customer_id').references(() => billingCustomers.id, {
      onDelete: 'set null',
    }),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    status: subscriptionStatusEnum('status').notNull(),
    seats: integer('seats').notNull().default(1),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    // Partial unique index: allows historical rows (canceled, expired) while preventing
    // duplicate active subscriptions per org.
    uniqueIndex('subscriptions_active_org_unique')
      .on(t.organizationId)
      .where(sql`status IN ('active', 'trialing', 'free')`),
    uniqueIndex('subscriptions_stripe_sub_unique').on(t.stripeSubscriptionId),
    index('subscriptions_status_idx').on(t.status),
    index('subscriptions_period_end_idx').on(t.currentPeriodEnd),
  ],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
