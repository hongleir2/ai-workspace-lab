import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { documentChunks } from './document_chunks';
import { documents } from './documents';
import { organizations } from './organizations';
import { users } from './users';

export const aiSessionVisibilityEnum = pgEnum('ai_session_visibility', [
  'private',
  'organization',
  'shared',
]);

export const aiSessionStatusEnum = pgEnum('ai_session_status', ['active', 'archived', 'deleted']);

export const aiMessageRoleEnum = pgEnum('ai_message_role', ['user', 'assistant', 'system', 'tool']);

export const aiMessageStatusEnum = pgEnum('ai_message_status', [
  'streaming',
  'completed',
  'failed',
  'canceled',
]);

export const rateLimitActionEnum = pgEnum('rate_limit_action', ['allowed', 'blocked']);

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    version: integer('version').notNull(),
    promptTemplate: text('prompt_template').notNull(),
    defaultModelProvider: text('default_model_provider'),
    defaultModelName: text('default_model_name'),
    isActive: boolean('is_active').notNull().default(true),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('prompt_versions_name_version_unique').on(t.name, t.version)],
);

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

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => aiSessions.id),
    parentMessageId: uuid('parent_message_id'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    role: aiMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    status: aiMessageStatusEnum('status').notNull().default('completed'),
    modelProvider: text('model_provider'),
    modelName: text('model_name'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    costMicroUsd: bigint('cost_micro_usd', { mode: 'number' }),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    unique('ai_messages_id_session_org_unique').on(t.id, t.sessionId, t.organizationId),
    foreignKey({
      columns: [t.sessionId, t.organizationId],
      foreignColumns: [aiSessions.id, aiSessions.organizationId],
      name: 'ai_messages_session_org_fk',
    }),
    foreignKey({
      columns: [t.parentMessageId, t.sessionId, t.organizationId],
      foreignColumns: [t.id, t.sessionId, t.organizationId],
      name: 'ai_messages_parent_same_session_fk',
    }),
    index('ai_messages_org_session_created_at_idx').on(t.organizationId, t.sessionId, t.createdAt),
    index('ai_messages_session_created_at_idx').on(t.sessionId, t.createdAt),
    index('ai_messages_org_created_at_idx').on(t.organizationId, t.createdAt),
    index('ai_messages_model_provider_model_name_idx').on(t.modelProvider, t.modelName),
  ],
);

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

export const aiMessageSources = pgTable(
  'ai_message_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    aiMessageId: uuid('ai_message_id')
      .notNull()
      .references(() => aiMessages.id),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    documentChunkId: uuid('document_chunk_id')
      .notNull()
      .references(() => documentChunks.id),
    relevanceScore: numeric('relevance_score', { precision: 5, scale: 4 }),
    citationLabel: text('citation_label'),
    quoteStartChar: integer('quote_start_char'),
    quoteEndChar: integer('quote_end_char'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('ai_message_sources_message_chunk_unique').on(t.aiMessageId, t.documentChunkId),
    index('ai_message_sources_message_id_idx').on(t.aiMessageId),
    index('ai_message_sources_org_id_idx').on(t.organizationId),
  ],
);

export type PromptVersion = typeof promptVersions.$inferSelect;
export type NewPromptVersion = typeof promptVersions.$inferInsert;
export type AiSession = typeof aiSessions.$inferSelect;
export type NewAiSession = typeof aiSessions.$inferInsert;
export type AiMessage = typeof aiMessages.$inferSelect;
export type NewAiMessage = typeof aiMessages.$inferInsert;
export type AiMessageSource = typeof aiMessageSources.$inferSelect;
export type NewAiMessageSource = typeof aiMessageSources.$inferInsert;
export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;
export type NewRateLimitEvent = typeof rateLimitEvents.$inferInsert;
