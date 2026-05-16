import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const stripeEvents = pgTable(
  'stripe_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stripeEventId: text('stripe_event_id').notNull(),
    eventType: text('event_type').notNull(),
    // CHECK constraint enforced at DB level in migration 0007; enum here for TypeScript safety.
    processingStatus: text('processing_status', {
      enum: ['received', 'processing', 'processed', 'failed'],
    })
      .notNull()
      .default('received'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    errorMessage: text('error_message'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('stripe_events_stripe_event_id_unique').on(t.stripeEventId),
    index('stripe_events_event_type_idx').on(t.eventType),
    index('stripe_events_processing_status_idx').on(t.processingStatus),
    index('stripe_events_received_at_idx').on(t.receivedAt),
  ],
);

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type NewStripeEvent = typeof stripeEvents.$inferInsert;
