/**
 * Integration test for the Day 46 AI chat migration (0014).
 *
 * Requires a real Postgres with migrations applied:
 *   supabase start && pnpm db:migrate
 *
 * Skipped automatically when DATABASE_URL is absent.
 */

import {
  aiMessages,
  aiSessions,
  organizations,
  promptVersions,
  rateLimitEvents,
  users,
} from '@ai-workspace-lab/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('AI chat tables', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { casing: 'snake_case' });

  const suffix = crypto.randomUUID().slice(0, 8);

  let userId: string;
  let orgId: string;
  let otherOrgId: string;
  let sessionId: string;
  let otherSessionId: string;
  let rootMessageId: string;
  let otherRootMessageId: string;
  let replyMessageId: string;
  let rateLimitEventId: string;

  beforeAll(async () => {
    await db.delete(organizations).where(eq(organizations.slug, `ai-chat-${suffix}`));
    await db.delete(users).where(eq(users.email, `ai-chat-${suffix}@example.com`));

    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId: `ai-chat-user-${suffix}`,
        email: `ai-chat-${suffix}@example.com`,
        status: 'active',
      })
      .returning({ id: users.id });
    userId = user?.id ?? '';
    if (!userId) throw new Error('Failed to seed user');

    const [org] = await db
      .insert(organizations)
      .values({
        name: `AI Chat Org ${suffix}`,
        slug: `ai-chat-${suffix}`,
        ownerUserId: userId,
        status: 'active',
      })
      .returning({ id: organizations.id });
    orgId = org?.id ?? '';
    if (!orgId) throw new Error('Failed to seed org');

    const [otherOrg] = await db
      .insert(organizations)
      .values({
        name: `AI Chat Other Org ${suffix}`,
        slug: `ai-chat-other-${suffix}`,
        ownerUserId: userId,
        status: 'active',
      })
      .returning({ id: organizations.id });
    otherOrgId = otherOrg?.id ?? '';
    if (!otherOrgId) throw new Error('Failed to seed other org');
  });

  afterAll(async () => {
    if (rateLimitEventId) {
      await db.delete(rateLimitEvents).where(eq(rateLimitEvents.id, rateLimitEventId));
    }
    if (replyMessageId) {
      await db.delete(aiMessages).where(eq(aiMessages.id, replyMessageId));
    }
    if (rootMessageId) {
      await db.delete(aiMessages).where(eq(aiMessages.id, rootMessageId));
    }
    if (otherRootMessageId) {
      await db.delete(aiMessages).where(eq(aiMessages.id, otherRootMessageId));
    }
    if (sessionId) {
      await db.delete(aiSessions).where(eq(aiSessions.id, sessionId));
    }
    if (otherSessionId) {
      await db.delete(aiSessions).where(eq(aiSessions.id, otherSessionId));
    }
    await db.delete(organizations).where(eq(organizations.id, otherOrgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it('seeds document_qa v1 and general_chat v1 prompt versions', async () => {
    const rows = await db
      .select()
      .from(promptVersions)
      .where(inArray(promptVersions.name, ['document_qa', 'general_chat']))
      .orderBy(asc(promptVersions.name));

    expect(rows).toHaveLength(2);
    const documentQa = rows.find((row) => row.name === 'document_qa');
    const generalChat = rows.find((row) => row.name === 'general_chat');

    expect(documentQa?.version).toBe(1);
    expect(documentQa?.isActive).toBe(true);
    expect(documentQa?.promptTemplate).toContain('{{question}}');
    expect(documentQa?.promptTemplate).toContain('{{context}}');

    expect(generalChat?.version).toBe(1);
    expect(generalChat?.isActive).toBe(true);
    expect(generalChat?.promptTemplate).toContain('helpful assistant');
  });

  it('rejects duplicate prompt_version name/version pairs', async () => {
    await expect(
      db.insert(promptVersions).values({
        name: 'document_qa',
        version: 1,
        promptTemplate: 'duplicate',
      }),
    ).rejects.toThrow();
  });

  it('inserts an ai_session with defaults and updates updated_at', async () => {
    const [promptVersion] = await db
      .select({ id: promptVersions.id })
      .from(promptVersions)
      .where(eq(promptVersions.name, 'document_qa'))
      .orderBy(asc(promptVersions.version))
      .limit(1);

    const [session] = await db
      .insert(aiSessions)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
        promptVersionId: promptVersion?.id,
      })
      .returning();

    expect(session).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    sessionId = session!.id;
    expect(session?.organizationId).toBe(orgId);
    expect(session?.createdByUserId).toBe(userId);
    expect(session?.promptVersionId).toBe(promptVersion?.id ?? null);
    expect(session?.visibility).toBe('private');
    expect(session?.status).toBe('active');
    expect(session?.createdAt).toBeInstanceOf(Date);
    expect(session?.updatedAt).toBeInstanceOf(Date);
    expect(session?.deletedAt).toBeNull();

    const before = session?.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 25));

    await db
      .update(aiSessions)
      .set({ title: 'Updated AI Session' })
      .where(eq(aiSessions.id, sessionId));

    const [after] = await db.select().from(aiSessions).where(eq(aiSessions.id, sessionId));
    expect(after?.title).toBe('Updated AI Session');
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.getTime() ?? 0);
  });

  it('inserts threaded ai_messages with model metadata', async () => {
    const [root] = await db
      .insert(aiMessages)
      .values({
        organizationId: orgId,
        sessionId,
        createdByUserId: userId,
        role: 'user',
        content: 'What changed in the Day 46 schema?',
        status: 'completed',
      })
      .returning();

    expect(root).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    rootMessageId = root!.id;
    expect(root?.organizationId).toBe(orgId);
    expect(root?.sessionId).toBe(sessionId);
    expect(root?.role).toBe('user');
    expect(root?.status).toBe('completed');

    const [reply] = await db
      .insert(aiMessages)
      .values({
        organizationId: orgId,
        sessionId,
        parentMessageId: rootMessageId,
        role: 'assistant',
        content: 'Added the AI chat tables and prompt seeds.',
        status: 'streaming',
        modelProvider: 'openai',
        modelName: 'gpt-4o-mini',
        inputTokens: 12,
        outputTokens: 18,
        totalTokens: 30,
        costMicroUsd: 42,
      })
      .returning();

    expect(reply).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    replyMessageId = reply!.id;
    expect(reply?.parentMessageId).toBe(rootMessageId);
    expect(reply?.role).toBe('assistant');
    expect(reply?.status).toBe('streaming');
    expect(reply?.modelProvider).toBe('openai');
    expect(reply?.modelName).toBe('gpt-4o-mini');
    expect(reply?.inputTokens).toBe(12);
    expect(reply?.outputTokens).toBe(18);
    expect(reply?.totalTokens).toBe(30);
    expect(reply?.costMicroUsd).toBe(42);
    expect(reply?.completedAt).toBeNull();
  });

  it('rejects ai_messages that reference a missing session', async () => {
    await expect(
      db.insert(aiMessages).values({
        organizationId: orgId,
        sessionId: '00000000-0000-0000-0000-000000000000',
        role: 'user',
        content: 'This should fail',
      }),
    ).rejects.toThrow();
  });

  it('rejects ai_messages whose organization does not match the session organization', async () => {
    await expect(
      db.insert(aiMessages).values({
        organizationId: otherOrgId,
        sessionId,
        role: 'user',
        content: 'This should fail because the session belongs to another organization',
      }),
    ).rejects.toThrow();
  });

  it('rejects parent ai_messages from another session', async () => {
    const [otherSession] = await db
      .insert(aiSessions)
      .values({
        organizationId: otherOrgId,
        createdByUserId: userId,
        title: 'Other org session',
      })
      .returning();
    otherSessionId = otherSession?.id ?? '';
    if (!otherSessionId) throw new Error('Failed to seed other session');

    const [otherRoot] = await db
      .insert(aiMessages)
      .values({
        organizationId: otherOrgId,
        sessionId: otherSessionId,
        createdByUserId: userId,
        role: 'user',
        content: 'Other session root',
      })
      .returning();
    otherRootMessageId = otherRoot?.id ?? '';
    if (!otherRootMessageId) throw new Error('Failed to seed other root message');

    await expect(
      db.insert(aiMessages).values({
        organizationId: orgId,
        sessionId,
        parentMessageId: otherRootMessageId,
        role: 'assistant',
        content: 'This should fail because the parent belongs to another session',
      }),
    ).rejects.toThrow();
  });

  it('inserts rate_limit_events rows with nullable org/user fields', async () => {
    const [event] = await db
      .insert(rateLimitEvents)
      .values({
        endpoint: '/api/ai/chat',
        limitKey: `org:${orgId}:ai_messages`,
        action: 'blocked',
        tokensConsumed: 2,
      })
      .returning();

    expect(event).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: just inserted
    rateLimitEventId = event!.id;
    expect(event?.organizationId).toBeNull();
    expect(event?.userId).toBeNull();
    expect(event?.endpoint).toBe('/api/ai/chat');
    expect(event?.limitKey).toBe(`org:${orgId}:ai_messages`);
    expect(event?.action).toBe('blocked');
    expect(event?.tokensConsumed).toBe(2);
    expect(event?.metadata).toEqual({});
    expect(event?.createdAt).toBeInstanceOf(Date);
  });
});
