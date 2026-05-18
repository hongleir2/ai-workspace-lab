/**
 * Integration test for the ai_message_sources migration (0017).
 *
 * Requires a real Postgres with migrations applied:
 *   supabase start && pnpm db:migrate
 *
 * Skipped automatically when DATABASE_URL is absent.
 */

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  aiMessageSources,
  aiMessages,
  aiSessions,
  documentChunks,
  documents,
  organizations,
  storageObjects,
  users,
} from './index.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('ai_message_sources table', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  let userId: string;
  let orgId: string;
  let storageObjectId: string;
  let documentId: string;
  let chunkId: string;
  let sessionId: string;
  let userMessageId: string;
  let assistantMessageId: string;
  let insertedSourceId: string;

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, 'rag-sources-test@example.com'));

    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'rag-sources-test-uid-001',
        email: 'rag-sources-test@example.com',
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    userId = user!.id;

    const [org] = await db
      .insert(organizations)
      .values({
        name: 'RAG Sources Test Org',
        slug: 'rag-sources-test-org',
        ownerUserId: userId,
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    orgId = org!.id;

    const [storageObj] = await db
      .insert(storageObjects)
      .values({
        organizationId: orgId,
        bucket: 'documents',
        objectKey: 'rag-sources-test-org/doc-001.pdf',
        originalFilename: 'test.pdf',
        contentType: 'application/pdf',
        byteSize: 1024,
        checksumSha256: 'sha256-rag-sources-001',
        uploadedByUserId: userId,
        status: 'uploaded',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    storageObjectId = storageObj!.id;

    const [doc] = await db
      .insert(documents)
      .values({
        organizationId: orgId,
        storageObjectId,
        createdByUserId: userId,
        title: 'RAG Test Document',
        sourceType: 'web_upload',
        fileType: 'pdf',
        checksumSha256: 'sha256-rag-sources-001',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    documentId = doc!.id;

    const [chunk] = await db
      .insert(documentChunks)
      .values({
        organizationId: orgId,
        documentId,
        chunkIndex: 0,
        text: 'Relevant context for RAG.',
        tokenCount: 5,
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    chunkId = chunk!.id;

    const [session] = await db
      .insert(aiSessions)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    sessionId = session!.id;

    const [userMsg] = await db
      .insert(aiMessages)
      .values({
        organizationId: orgId,
        sessionId,
        createdByUserId: userId,
        role: 'user',
        content: 'What does the document say?',
        status: 'completed',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    userMessageId = userMsg!.id;

    const [assistantMsg] = await db
      .insert(aiMessages)
      .values({
        organizationId: orgId,
        sessionId,
        role: 'assistant',
        content: 'Based on the document, it says relevant context.',
        status: 'completed',
        modelProvider: 'openai',
        modelName: 'gpt-4o-mini',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    assistantMessageId = assistantMsg!.id;
  });

  afterAll(async () => {
    if (insertedSourceId) {
      await db.delete(aiMessageSources).where(eq(aiMessageSources.id, insertedSourceId));
    }
    await db.delete(aiMessages).where(eq(aiMessages.sessionId, sessionId));
    await db.delete(aiSessions).where(eq(aiSessions.id, sessionId));
    await db.delete(documentChunks).where(eq(documentChunks.id, chunkId));
    await db.delete(documents).where(eq(documents.id, documentId));
    await db.delete(storageObjects).where(eq(storageObjects.id, storageObjectId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it('inserts an ai_message_source row with relevance score and citation label', async () => {
    const [source] = await db
      .insert(aiMessageSources)
      .values({
        organizationId: orgId,
        aiMessageId: assistantMessageId,
        documentId,
        documentChunkId: chunkId,
        relevanceScore: '0.8500',
        citationLabel: '[1]',
      })
      .returning();

    expect(source).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    insertedSourceId = source!.id;
    expect(source?.organizationId).toBe(orgId);
    expect(source?.aiMessageId).toBe(assistantMessageId);
    expect(source?.documentId).toBe(documentId);
    expect(source?.documentChunkId).toBe(chunkId);
    expect(source?.relevanceScore).toBe('0.8500');
    expect(source?.citationLabel).toBe('[1]');
    expect(source?.createdAt).toBeInstanceOf(Date);
  });

  it('enforces unique (ai_message_id, document_chunk_id) constraint', async () => {
    await expect(
      db.insert(aiMessageSources).values({
        organizationId: orgId,
        aiMessageId: assistantMessageId,
        documentId,
        documentChunkId: chunkId,
        relevanceScore: '0.7000',
        citationLabel: '[1]',
      }),
    ).rejects.toThrow();
  });

  it('rejects insert with non-existent ai_message_id (FK constraint)', async () => {
    await expect(
      db.insert(aiMessageSources).values({
        organizationId: orgId,
        aiMessageId: '00000000-0000-0000-0000-000000000000',
        documentId,
        documentChunkId: chunkId,
      }),
    ).rejects.toThrow();
  });

  it('rejects insert with non-existent document_chunk_id (FK constraint)', async () => {
    await expect(
      db.insert(aiMessageSources).values({
        organizationId: orgId,
        aiMessageId: assistantMessageId,
        documentId,
        documentChunkId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow();
  });

  it('filters sources by organization_id — cross-org isolation', async () => {
    const otherOrgId = '00000000-0000-0000-0000-000000000099';
    const rows = await db
      .select()
      .from(aiMessageSources)
      .where(
        and(
          eq(aiMessageSources.aiMessageId, assistantMessageId),
          eq(aiMessageSources.organizationId, otherOrgId),
        ),
      );
    expect(rows).toHaveLength(0);
  });

  it('unused user message row exists (validates setup)', () => {
    expect(userMessageId).toBeDefined();
  });
});
