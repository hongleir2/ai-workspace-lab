/**
 * Integration test for the audit_logs migration.
 *
 * Requires a real Postgres instance with migrations applied.
 * Skipped automatically when DATABASE_URL is absent.
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLogs } from './audit_logs.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('audit_logs table', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  let orgId: string;
  let actorUserId: string;
  let logId: string;

  beforeAll(async () => {
    await db.delete(organizations).where(eq(organizations.slug, 'audit-test-org'));
    await db.delete(users).where(eq(users.email, 'audit-actor@example.com'));

    const [actor] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: 'audit-test-uid-001',
        email: 'audit-actor@example.com',
        status: 'active',
      })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    actorUserId = actor!.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: 'Audit Test Org', slug: 'audit-test-org', status: 'active' })
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    orgId = org!.id;
  });

  afterAll(async () => {
    if (logId) {
      await db.delete(auditLogs).where(eq(auditLogs.id, logId));
    }
    if (orgId) {
      await db.delete(organizations).where(eq(organizations.id, orgId));
    }
    if (actorUserId) {
      await db.delete(users).where(eq(users.id, actorUserId));
    }
    await client.end();
  });

  it('inserts an audit log row', async () => {
    const [row] = await db
      .insert(auditLogs)
      .values({
        organizationId: orgId,
        actorUserId,
        action: 'org.settings.updated',
        entityType: 'organization',
        entityId: orgId,
        afterState: { name: 'New Name' },
        ipAddress: '203.0.113.1',
        userAgent: 'Mozilla/5.0',
      })
      .returning();

    expect(row).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    logId = row!.id;
    expect(row?.action).toBe('org.settings.updated');
    expect(row?.entityType).toBe('organization');
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.ipAddress).toBe('203.0.113.1');
  });

  it('allows null organization_id for platform-level events', async () => {
    const [row] = await db
      .insert(auditLogs)
      .values({
        actorUserId,
        action: 'platform.user.disabled',
        entityType: 'user',
        entityId: actorUserId,
      })
      .returning();

    expect(row?.organizationId).toBeNull();
    if (row?.id) {
      await db.delete(auditLogs).where(eq(auditLogs.id, row.id));
    }
  });

  it('allows null actor_user_id for system events', async () => {
    const [row] = await db
      .insert(auditLogs)
      .values({
        organizationId: orgId,
        action: 'system.quota.reset',
        entityType: 'organization',
        entityId: orgId,
      })
      .returning();

    expect(row?.actorUserId).toBeNull();
    if (row?.id) {
      await db.delete(auditLogs).where(eq(auditLogs.id, row.id));
    }
  });

  it('has no updated_at column (append-only log)', async () => {
    const row = await db.select().from(auditLogs).where(eq(auditLogs.id, logId));
    expect(row[0]).toBeDefined();
    expect(Object.keys(row[0] ?? {})).not.toContain('updatedAt');
  });
});
