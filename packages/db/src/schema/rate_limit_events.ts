import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const rateLimitActionEnum = pgEnum('rate_limit_action', ['allowed', 'blocked']);

export const rateLimitEvents = pgTable(
  'rate_limit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id),
    endpoint: text('endpoint').notNull(),
    limitKey: text('limit_key').notNull(),
    action: rateLimitActionEnum('action').notNull(),
    tokensConsumed: integer('tokens_consumed'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rate_limit_events_org_created_at_idx').on(t.organizationId, t.createdAt),
    index('rate_limit_events_user_created_at_idx').on(t.userId, t.createdAt),
    index('rate_limit_events_endpoint_created_at_idx').on(t.endpoint, t.createdAt),
    index('rate_limit_events_action_created_at_idx').on(t.action, t.createdAt),
  ],
);

export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;
export type NewRateLimitEvent = typeof rateLimitEvents.$inferInsert;
