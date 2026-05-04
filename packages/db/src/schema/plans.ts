import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const billingIntervalEnum = pgEnum('billing_interval', ['none', 'month', 'year']);

export const plans = pgTable(
  'plans',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    billingInterval: billingIntervalEnum('billing_interval').notNull().default('none'),
    priceCents: integer('price_cents').notNull().default(0),
    currency: text('currency').notNull().default('usd'),
    stripePriceId: text('stripe_price_id'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('plans_stripe_price_id_unique').on(t.stripePriceId),
    index('plans_is_active_idx').on(t.isActive),
  ],
);

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
