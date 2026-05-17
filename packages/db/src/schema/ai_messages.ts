import {
  bigint,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { aiSessions } from './ai_sessions';
import { organizations } from './organizations';
import { users } from './users';

export const aiMessageRoleEnum = pgEnum('ai_message_role', ['user', 'assistant', 'system', 'tool']);

export const aiMessageStatusEnum = pgEnum('ai_message_status', [
  'streaming',
  'completed',
  'failed',
  'canceled',
]);

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
    index('ai_messages_model_provider_name_idx').on(t.modelProvider, t.modelName),
  ],
);

export type AiMessage = typeof aiMessages.$inferSelect;
export type NewAiMessage = typeof aiMessages.$inferInsert;
