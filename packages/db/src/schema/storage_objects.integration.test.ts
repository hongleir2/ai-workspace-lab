/**
 * Integration test for the storage_objects migration (0009).
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
import { organizationMemberships } from './organization_memberships.js';
import { organizations } from './organizations.js';
import { storageObjects } from './storage_objects.js';
import { users } from './users.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('storage_objects table', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  let userId: string;
  let orgId: string;
  let insertedId: string;

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, 'storage-test@example.com'));

    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'storage-test-uid-001',
        email: 'storage-test@example.com',
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    userId = user!.id;

    const [org] = await db
      .insert(organizations)
      .values({
        name: 'Storage Test Org',
        slug: 'storage-test-org',
        ownerUserId: userId,
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    orgId = org!.id;
  });

  afterAll(async () => {
    if (insertedId) {
      await db.delete(storageObjects).where(eq(storageObjects.id, insertedId));
    }
    await db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it('inserts a storage object row', async () => {
    const [row] = await db
      .insert(storageObjects)
      .values({
        organizationId: orgId,
        bucket: 'documents',
        objectKey: 'test-org/file-001.pdf',
        originalFilename: 'report.pdf',
        contentType: 'application/pdf',
        byteSize: 204800,
        checksumSha256: 'abc123',
        uploadedByUserId: userId,
        status: 'uploaded',
      })
      .returning();

    expect(row).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    insertedId = row!.id;
    expect(row?.bucket).toBe('documents');
    expect(row?.objectKey).toBe('test-org/file-001.pdf');
    expect(row?.byteSize).toBe(204800);
    expect(row?.status).toBe('uploaded');
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.deletedAt).toBeNull();
  });

  it('enforces UNIQUE(bucket, object_key)', async () => {
    await expect(
      db.insert(storageObjects).values({
        organizationId: orgId,
        bucket: 'documents',
        objectKey: 'test-org/file-001.pdf',
        originalFilename: 'report-dup.pdf',
        contentType: 'application/pdf',
        byteSize: 1024,
        uploadedByUserId: userId,
        status: 'uploaded',
      }),
    ).rejects.toThrow();
  });

  it('rejects insert with non-existent organization_id (FK constraint)', async () => {
    await expect(
      db.insert(storageObjects).values({
        organizationId: '00000000-0000-0000-0000-000000000000',
        bucket: 'documents',
        objectKey: 'bad-org/file.pdf',
        originalFilename: 'file.pdf',
        contentType: 'application/pdf',
        byteSize: 512,
        uploadedByUserId: userId,
        status: 'uploaded',
      }),
    ).rejects.toThrow();
  });

  it('soft-deletes by setting deleted_at and status', async () => {
    await db
      .update(storageObjects)
      .set({ deletedAt: new Date(), status: 'deleted' })
      .where(eq(storageObjects.id, insertedId));

    const [row] = await db.select().from(storageObjects).where(eq(storageObjects.id, insertedId));
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect(row?.status).toBe('deleted');
  });
});
