import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { storageObjects } from './storage_objects';
import { users } from './users';

export const documentStatusEnum = pgEnum('document_status', [
  'uploaded',
  'queued',
  'processing',
  'chunking',
  'embedding',
  'indexed',
  'ready',
  'failed',
  'deleted',
]);

export const documentSourceTypeEnum = pgEnum('document_source_type', [
  'web_upload',
  'desktop_upload',
  'api',
  'url',
]);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    storageObjectId: uuid('storage_object_id')
      .notNull()
      .references(() => storageObjects.id),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    sourceType: documentSourceTypeEnum('source_type').notNull(),
    fileType: text('file_type').notNull(),
    status: documentStatusEnum('status').notNull().default('uploaded'),
    processingErrorCode: text('processing_error_code'),
    processingErrorMessage: text('processing_error_message'),
    pageCount: integer('page_count'),
    language: text('language'),
    checksumSha256: text('checksum_sha256'),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('documents_org_status_idx').on(t.organizationId, t.status),
    index('documents_org_created_at_idx').on(t.organizationId, t.createdAt),
    index('documents_created_by_created_at_idx').on(t.createdByUserId, t.createdAt),
    index('documents_checksum_idx').on(t.checksumSha256),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
