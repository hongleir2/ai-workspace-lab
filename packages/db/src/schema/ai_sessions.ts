import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { promptVersions } from './prompt_versions';
import { users } from './users';

export const aiSessionVisibilityEnum = pgEnum('ai_session_visibility', [
  'private',
  'organization',
  'shared',
]);

export const aiSessionStatusEnum = pgEnum('ai_session_status', ['active', 'archived', 'deleted']);

export const aiSessions = pgTable(
  'ai_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    promptVersionId: uuid('prompt_version_id').references(() => promptVersions.id),
    title: text('title'),
    visibility: aiSessionVisibilityEnum('visibility').notNull().default('private'),
    status: aiSessionStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    unique('ai_sessions_id_org_unique').on(t.id, t.organizationId),
    index('ai_sessions_org_created_at_idx').on(t.organizationId, t.createdAt),
    index('ai_sessions_created_by_created_at_idx').on(t.createdByUserId, t.createdAt),
    index('ai_sessions_org_status_idx').on(t.organizationId, t.status),
  ],
);

export type AiSession = typeof aiSessions.$inferSelect;
export type NewAiSession = typeof aiSessions.$inferInsert;
