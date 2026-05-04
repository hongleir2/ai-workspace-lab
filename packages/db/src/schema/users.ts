import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { citext } from './custom-types.js';

export const userStatusEnum = pgEnum('user_status', ['active', 'disabled', 'deleted']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // auth_provider + auth_provider_user_id identify the external auth record.
    // Together they form the composite unique key that maps an auth identity to
    // one app user. Use 'supabase' as the provider value for Supabase Auth.
    authProvider: text('auth_provider').notNull(),
    authProviderUserId: text('auth_provider_user_id').notNull(),

    email: citext('email').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    timezone: text('timezone'),
    status: userStatusEnum('status').notNull().default('active'),

    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // Soft delete: set deleted_at + status='deleted' instead of hard-deleting rows.
    // Auth records outlive app rows; keeping the row avoids orphaned foreign keys.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Composite unique: one app user per (provider, provider-user-id) pair.
    uniqueIndex('users_auth_provider_uid_unique').on(t.authProvider, t.authProviderUserId),
    uniqueIndex('users_email_unique').on(t.email),
    index('users_status_idx').on(t.status),
    index('users_last_seen_at_idx').on(t.lastSeenAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
