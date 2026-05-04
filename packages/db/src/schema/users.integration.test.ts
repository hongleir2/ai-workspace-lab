/**
 * Integration test for the users migration.
 *
 * Requires a real Postgres instance with the migration applied:
 *   supabase start          # or any local Postgres with citext extension
 *   pnpm db:migrate
 *
 * Set DATABASE_URL to run:
 *   DATABASE_URL=postgresql://... pnpm test
 *
 * Skipped automatically when DATABASE_URL is absent (CI without a database service).
 * See CLAUDE.md §5: "No mocking the database for integration tests."
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from './users.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('users table', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  afterAll(async () => {
    await client.end();
  });

  let insertedId: string;

  beforeAll(async () => {
    // Clean up any leftover test rows from a previous interrupted run.
    await db.delete(users).where(eq(users.email, 'test-migration@example.com'));
  });

  it('inserts a user row', async () => {
    const [row] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'test-uid-001',
        email: 'test-migration@example.com',
        displayName: 'Migration Test',
        status: 'active',
      })
      .returning();

    expect(row).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    insertedId = row!.id;
    expect(row?.email).toBe('test-migration@example.com');
    expect(row?.status).toBe('active');
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  it('email unique index is case-insensitive (citext)', async () => {
    await expect(
      db.insert(users).values({
        authProvider: 'supabase',
        authProviderUserId: 'test-uid-002',
        email: 'TEST-MIGRATION@EXAMPLE.COM', // same address, different case
        status: 'active',
      }),
    ).rejects.toThrow();
  });

  it('composite unique index rejects duplicate (provider, provider_user_id)', async () => {
    await expect(
      db.insert(users).values({
        authProvider: 'supabase',
        authProviderUserId: 'test-uid-001', // duplicate
        email: 'other@example.com',
        status: 'active',
      }),
    ).rejects.toThrow();
  });

  it('updated_at advances on update', async () => {
    const before = await db.select().from(users).where(eq(users.id, insertedId));
    const originalUpdatedAt = before[0]?.updatedAt;

    // Small delay so the timestamp actually differs.
    await new Promise((r) => setTimeout(r, 10));

    await db.update(users).set({ displayName: 'Updated' }).where(eq(users.id, insertedId));

    const after = await db.select().from(users).where(eq(users.id, insertedId));
    expect(after[0]?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() ?? 0);
  });

  afterAll(async () => {
    if (insertedId) {
      await db.delete(users).where(eq(users.id, insertedId));
    }
  });
});
