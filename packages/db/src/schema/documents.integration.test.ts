/**
 * Integration test for the documents migration (0010).
 *
 * Requires a real Postgres with migrations applied:
 *   supabase start && pnpm db:migrate
 *
 * Skipped automatically when DATABASE_URL is absent.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { documents } from './documents.js';
import { organizationMemberships } from './organization_memberships.js';
import { organizations } from './organizations.js';
import { storageObjects } from './storage_objects.js';
import { users } from './users.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('documents table', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  let userId: string;
  let orgId: string;
  let storageObjectId: string;
  let insertedDocId: string;
  let altOrgId: string;
  let altStorageObjectId: string;

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, 'docs-test@example.com'));

    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'docs-test-uid-001',
        email: 'docs-test@example.com',
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    userId = user!.id;

    const [org] = await db
      .insert(organizations)
      .values({
        name: 'Docs Test Org',
        slug: 'docs-test-org',
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
        objectKey: 'docs-test-org/doc-001.pdf',
        originalFilename: 'report.pdf',
        contentType: 'application/pdf',
        byteSize: 102400,
        checksumSha256: 'sha256-doc-001',
        uploadedByUserId: userId,
        status: 'uploaded',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    storageObjectId = storageObj!.id;

    const [altOrg] = await db
      .insert(organizations)
      .values({
        name: 'Alt Org',
        slug: 'docs-test-alt-org',
        ownerUserId: userId,
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    altOrgId = altOrg!.id;

    const [altStorageObj] = await db
      .insert(storageObjects)
      .values({
        organizationId: altOrgId,
        bucket: 'documents',
        objectKey: 'docs-test-alt-org/alt-doc-001.pdf',
        originalFilename: 'alt-report.pdf',
        contentType: 'application/pdf',
        byteSize: 204800,
        checksumSha256: 'sha256-alt-doc-001',
        uploadedByUserId: userId,
        status: 'uploaded',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    altStorageObjectId = altStorageObj!.id;
  });

  afterAll(async () => {
    if (insertedDocId) {
      await db.delete(documents).where(eq(documents.id, insertedDocId));
    }
    await db.delete(storageObjects).where(eq(storageObjects.id, altStorageObjectId));
    await db.delete(organizations).where(eq(organizations.id, altOrgId));
    await db.delete(storageObjects).where(eq(storageObjects.id, storageObjectId));
    await db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it('inserts a document row with default status', async () => {
    const [row] = await db
      .insert(documents)
      .values({
        organizationId: orgId,
        storageObjectId,
        createdByUserId: userId,
        title: 'Q4 Report',
        sourceType: 'web_upload',
        fileType: 'pdf',
        checksumSha256: 'sha256-doc-001',
      })
      .returning();

    expect(row).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    insertedDocId = row!.id;
    expect(row?.title).toBe('Q4 Report');
    expect(row?.status).toBe('uploaded');
    expect(row?.sourceType).toBe('web_upload');
    expect(row?.fileType).toBe('pdf');
    expect(row?.processingErrorCode).toBeNull();
    expect(row?.readyAt).toBeNull();
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
    expect(row?.deletedAt).toBeNull();
  });

  it('updated_at advances on status change', async () => {
    const [before] = await db.select().from(documents).where(eq(documents.id, insertedDocId));
    const originalUpdatedAt = before?.updatedAt;

    await new Promise((r) => setTimeout(r, 50));

    await db.update(documents).set({ status: 'queued' }).where(eq(documents.id, insertedDocId));

    const [after] = await db.select().from(documents).where(eq(documents.id, insertedDocId));
    expect(after?.status).toBe('queued');
    expect(after?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() ?? 0);
  });

  it('rejects insert with non-existent storage_object_id (FK constraint)', async () => {
    await expect(
      db.insert(documents).values({
        organizationId: orgId,
        storageObjectId: '00000000-0000-0000-0000-000000000000',
        createdByUserId: userId,
        title: 'Bad Doc',
        sourceType: 'web_upload',
        fileType: 'pdf',
      }),
    ).rejects.toThrow();
  });

  it('rejects insert with non-existent organization_id (FK constraint)', async () => {
    await expect(
      db.insert(documents).values({
        organizationId: '00000000-0000-0000-0000-000000000000',
        storageObjectId,
        createdByUserId: userId,
        title: 'Bad Org Doc',
        sourceType: 'web_upload',
        fileType: 'pdf',
      }),
    ).rejects.toThrow();
  });

  it('records processing error fields', async () => {
    await db
      .update(documents)
      .set({
        status: 'failed',
        processingErrorCode: 'PARSE_ERROR',
        processingErrorMessage: 'Could not parse PDF structure',
      })
      .where(eq(documents.id, insertedDocId));

    const [row] = await db.select().from(documents).where(eq(documents.id, insertedDocId));
    expect(row?.status).toBe('failed');
    expect(row?.processingErrorCode).toBe('PARSE_ERROR');
    expect(row?.processingErrorMessage).toBe('Could not parse PDF structure');
  });

  it('document belongs to its organization — query with correct org returns the document', async () => {
    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, insertedDocId), eq(documents.organizationId, orgId)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.organizationId).toBe(orgId);
  });

  it('user cannot view another org document — query with wrong organizationId returns nothing', async () => {
    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, insertedDocId), eq(documents.organizationId, altOrgId)));
    expect(rows).toHaveLength(0);
  });

  it('soft-deleted document is excluded from org document list', async () => {
    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, insertedDocId));

    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.organizationId, orgId), isNull(documents.deletedAt)));

    const found = rows.find((r) => r.id === insertedDocId);
    expect(found).toBeUndefined();

    await db.update(documents).set({ deletedAt: null }).where(eq(documents.id, insertedDocId));
  });
});
