import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { vector } from './custom-types';
import { documents } from './documents';
import { organizations } from './organizations';

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    chunkIndex: integer('chunk_index').notNull(),
    text: text('text').notNull(),
    tokenCount: integer('token_count'),
    pageStart: integer('page_start'),
    pageEnd: integer('page_end'),
    sectionTitle: text('section_title'),
    embedding: vector(1536)('embedding'),
    embeddingModel: text('embedding_model'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('document_chunks_document_id_chunk_index_unique').on(t.documentId, t.chunkIndex),
    index('document_chunks_org_doc_idx').on(t.organizationId, t.documentId),
    index('document_chunks_org_created_at_idx').on(t.organizationId, t.createdAt),
  ],
);

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
