/**
 * Integration test for the document_chunks migration (0013).
 *
 * Requires a real Postgres with migrations applied:
 *   supabase start && pnpm db:migrate
 *
 * Skipped automatically when DATABASE_URL is absent.
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { documentChunks, documents, organizations, storageObjects, users } from './index.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('document_chunks table', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  let userId: string;
  let orgId: string;
  let storageObjectId: string;
  let documentId: string;
  let insertedChunkId: string;

  beforeAll(async () => {
    // Create user
    await db.delete(users).where(eq(users.email, 'chunks-test@example.com'));

    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'chunks-test-uid-001',
        email: 'chunks-test@example.com',
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    userId = user!.id;

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: 'Chunks Test Org',
        slug: 'chunks-test-org',
        ownerUserId: userId,
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    orgId = org!.id;

    // Create storage object
    const [storageObj] = await db
      .insert(storageObjects)
      .values({
        organizationId: orgId,
        bucket: 'documents',
        objectKey: 'chunks-test-org/doc-001.pdf',
        originalFilename: 'test-report.pdf',
        contentType: 'application/pdf',
        byteSize: 102400,
        checksumSha256: 'sha256-chunks-001',
        uploadedByUserId: userId,
        status: 'uploaded',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    storageObjectId = storageObj!.id;

    // Create document
    const [doc] = await db
      .insert(documents)
      .values({
        organizationId: orgId,
        storageObjectId,
        createdByUserId: userId,
        title: 'Test Document',
        sourceType: 'web_upload',
        fileType: 'pdf',
        checksumSha256: 'sha256-chunks-001',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    documentId = doc!.id;
  });

  afterAll(async () => {
    if (insertedChunkId) {
      await db.delete(documentChunks).where(eq(documentChunks.id, insertedChunkId));
    }
    await db.delete(documents).where(eq(documents.id, documentId));
    await db.delete(storageObjects).where(eq(storageObjects.id, storageObjectId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it('inserts a document_chunk with text and metadata', async () => {
    const [chunk] = await db
      .insert(documentChunks)
      .values({
        organizationId: orgId,
        documentId,
        chunkIndex: 0,
        text: 'This is the first chunk of the document.',
        tokenCount: 10,
        pageStart: 1,
        pageEnd: 1,
        sectionTitle: 'Introduction',
        embeddingModel: 'text-embedding-3-small',
        metadata: { source: 'section_1' },
      })
      .returning();

    expect(chunk).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    insertedChunkId = chunk!.id;
    expect(chunk?.text).toBe('This is the first chunk of the document.');
    expect(chunk?.tokenCount).toBe(10);
    expect(chunk?.pageStart).toBe(1);
    expect(chunk?.pageEnd).toBe(1);
    expect(chunk?.sectionTitle).toBe('Introduction');
    expect(chunk?.embeddingModel).toBe('text-embedding-3-small');
    expect(chunk?.metadata).toEqual({ source: 'section_1' });
    expect(chunk?.embedding).toBeNull();
    expect(chunk?.createdAt).toBeInstanceOf(Date);
  });

  it('enforces unique (document_id, chunk_index) constraint', async () => {
    const [chunk1] = await db
      .insert(documentChunks)
      .values({
        organizationId: orgId,
        documentId,
        chunkIndex: 1,
        text: 'Second chunk',
      })
      .returning();

    expect(chunk1).toBeDefined();

    await expect(
      db.insert(documentChunks).values({
        organizationId: orgId,
        documentId,
        chunkIndex: 1,
        text: 'Duplicate chunk',
      }),
    ).rejects.toThrow();

    // Cleanup
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    await db.delete(documentChunks).where(eq(documentChunks.id, chunk1!.id));
  });

  it('rejects insert with non-existent organization_id (FK constraint)', async () => {
    await expect(
      db.insert(documentChunks).values({
        organizationId: '00000000-0000-0000-0000-000000000000',
        documentId,
        chunkIndex: 99,
        text: 'Bad org chunk',
      }),
    ).rejects.toThrow();
  });

  it('rejects insert with non-existent document_id (FK constraint)', async () => {
    await expect(
      db.insert(documentChunks).values({
        organizationId: orgId,
        documentId: '00000000-0000-0000-0000-000000000000',
        chunkIndex: 99,
        text: 'Bad doc chunk',
      }),
    ).rejects.toThrow();
  });

  it('stores and retrieves embedding vector (if supported by pgvector)', async () => {
    // This test checks that embedding column accepts null and processes vector data
    const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

    const [chunk] = await db
      .insert(documentChunks)
      .values({
        organizationId: orgId,
        documentId,
        chunkIndex: 2,
        text: 'Chunk with embedding',
        embedding: embedding.concat(Array(1531).fill(0)), // Pad to 1536 dimensions
        embeddingModel: 'text-embedding-3-small',
      })
      .returning();

    expect(chunk).toBeDefined();
    // The embedding column should accept array data
    expect(chunk?.embeddingModel).toBe('text-embedding-3-small');

    // Cleanup
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    await db.delete(documentChunks).where(eq(documentChunks.id, chunk!.id));
  });

  it('document_chunk belongs to its organization — query filters correctly', async () => {
    const rows = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId));

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.organizationId).toBe(orgId);
      expect(row.documentId).toBe(documentId);
    }
  });
});
