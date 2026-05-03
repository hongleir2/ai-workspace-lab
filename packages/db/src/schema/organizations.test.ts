/**
 * Integration test for the organizations migration.
 *
 * Requires a real Postgres instance with migrations applied:
 *   supabase start && pnpm db:migrate
 *
 * Set DATABASE_URL to run:
 *   DATABASE_URL=postgresql://... pnpm test
 *
 * Skipped automatically when DATABASE_URL is absent.
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { organizationMemberships } from './organization_memberships.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('organizations table', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  let ownerUserId: string;
  let insertedOrgId: string;

  beforeAll(async () => {
    // Clean up memberships first — organization_memberships.organization_id FK has no cascade.
    const existing = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, 'test-org-slug'));
    if (existing[0]) {
      await db
        .delete(organizationMemberships)
        .where(eq(organizationMemberships.organizationId, existing[0].id));
    }
    await db.delete(organizations).where(eq(organizations.slug, 'test-org-slug'));
    await db.delete(users).where(eq(users.email, 'org-owner@example.com'));

    const [owner] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'org-test-uid-001',
        email: 'org-owner@example.com',
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    ownerUserId = owner!.id;
  });

  afterAll(async () => {
    if (insertedOrgId) {
      await db.delete(organizations).where(eq(organizations.id, insertedOrgId));
    }
    await db.delete(users).where(eq(users.email, 'org-owner@example.com'));
    await client.end();
  });

  it('inserts an organization row', async () => {
    const [row] = await db
      .insert(organizations)
      .values({
        name: 'Test Org',
        slug: 'test-org-slug',
        ownerUserId,
        status: 'active',
      })
      .returning();

    expect(row).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    insertedOrgId = row!.id;
    expect(row?.name).toBe('Test Org');
    expect(row?.slug).toBe('test-org-slug');
    expect(row?.status).toBe('active');
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
    expect(row?.deletedAt).toBeNull();
  });

  it('slug unique index is case-insensitive (citext)', async () => {
    await expect(
      db.insert(organizations).values({
        name: 'Duplicate Org',
        slug: 'TEST-ORG-SLUG',
        status: 'active',
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate slug', async () => {
    await expect(
      db.insert(organizations).values({
        name: 'Another Org',
        slug: 'test-org-slug',
        status: 'active',
      }),
    ).rejects.toThrow();
  });

  it('updated_at advances on update', async () => {
    const before = await db.select().from(organizations).where(eq(organizations.id, insertedOrgId));
    const originalUpdatedAt = before[0]?.updatedAt;

    await new Promise((r) => setTimeout(r, 10));

    await db
      .update(organizations)
      .set({ name: 'Updated Org' })
      .where(eq(organizations.id, insertedOrgId));

    const after = await db.select().from(organizations).where(eq(organizations.id, insertedOrgId));
    expect(after[0]?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() ?? 0);
  });

  it('allows null owner_user_id', async () => {
    const [row] = await db
      .insert(organizations)
      .values({
        name: 'Ownerless Org',
        slug: 'ownerless-org-slug',
        status: 'active',
      })
      .returning();

    expect(row?.ownerUserId).toBeNull();
    if (row?.id) {
      await db.delete(organizations).where(eq(organizations.id, row.id));
    }
  });
});
