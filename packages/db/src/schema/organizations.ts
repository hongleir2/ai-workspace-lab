import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { citext } from './custom-types';
import { users } from './users';

export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended', 'deleted']);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: citext('slug').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    status: orgStatusEnum('status').notNull().default('active'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('organizations_slug_unique').on(t.slug),
    index('organizations_owner_user_id_idx').on(t.ownerUserId),
    index('organizations_status_idx').on(t.status),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
