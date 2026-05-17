/**
 * Integration tests for the AI chat schema migration (0014).
 *
 * Requires a real Postgres with migrations applied:
 *   supabase start && pnpm db:migrate
 *
 * Skipped automatically when DATABASE_URL is absent.
 */

import * as schema from '@ai-workspace-lab/db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aiMessages } from './ai_messages';
import { aiSessions } from './ai_sessions';
import { organizations } from './organizations';
import { promptVersions } from './prompt_versions';
import { rateLimitEvents } from './rate_limit_events';
import { users } from './users';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('ai chat schema', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `ai-chat-${suffix}@example.com`;
  const authProviderUserId = `ai-chat-${suffix}`;
  const orgSlug = `ai-chat-org-${suffix}`;
  const otherOrgSlug = `ai-chat-other-org-${suffix}`;
  const promptName = `document_qa_${suffix}`;

  let userId: string;
  let orgId: string;
  let otherOrgId: string;
  let promptVersionId: string;
  let sessionId: string;
  let otherSessionId: string;
  let userMessageId: string;
  let otherUserMessageId: string;
  let assistantMessageId: string;
  let rateLimitEventId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        authProvider: 'supabase',
        authProviderUserId,
        email,
        status: 'active',
      })
      .returning();
    if (!user) throw new Error('expected user insert to return a row');
    userId = user.id;

    const [org] = await db
      .insert(organizations)
      .values({
        name: 'AI Chat Test Org',
        slug: orgSlug,
        ownerUserId: userId,
        status: 'active',
      })
      .returning();
    if (!org) throw new Error('expected organization insert to return a row');
    orgId = org.id;

    const [otherOrg] = await db
      .insert(organizations)
      .values({
        name: 'AI Chat Other Test Org',
        slug: otherOrgSlug,
        ownerUserId: userId,
        status: 'active',
      })
      .returning();
    if (!otherOrg) throw new Error('expected other organization insert to return a row');
    otherOrgId = otherOrg.id;

    const [promptVersion] = await db
      .insert(promptVersions)
      .values({
        name: promptName,
        version: 1,
        promptTemplate: 'Test prompt template',
        isActive: true,
        createdByUserId: userId,
      })
      .returning();
    if (!promptVersion) throw new Error('expected prompt version insert to return a row');
    promptVersionId = promptVersion.id;

    const [session] = await db
      .insert(aiSessions)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
        promptVersionId,
        title: 'Test session',
      })
      .returning();
    if (!session) throw new Error('expected AI session insert to return a row');
    sessionId = session.id;

    const [otherSession] = await db
      .insert(aiSessions)
      .values({
        organizationId: otherOrgId,
        createdByUserId: userId,
        promptVersionId,
        title: 'Other org test session',
      })
      .returning();
    if (!otherSession) throw new Error('expected other AI session insert to return a row');
    otherSessionId = otherSession.id;
  });

  afterAll(async () => {
    if (assistantMessageId) {
      await db.delete(aiMessages).where(eq(aiMessages.id, assistantMessageId));
    }
    if (userMessageId) {
      await db.delete(aiMessages).where(eq(aiMessages.id, userMessageId));
    }
    if (otherUserMessageId) {
      await db.delete(aiMessages).where(eq(aiMessages.id, otherUserMessageId));
    }
    if (rateLimitEventId) {
      await db.delete(rateLimitEvents).where(eq(rateLimitEvents.id, rateLimitEventId));
    }
    if (sessionId) {
      await db.delete(aiSessions).where(eq(aiSessions.id, sessionId));
    }
    if (otherSessionId) {
      await db.delete(aiSessions).where(eq(aiSessions.id, otherSessionId));
    }
    if (promptVersionId) {
      await db.delete(promptVersions).where(eq(promptVersions.id, promptVersionId));
    }
    if (orgId) {
      await db.delete(organizations).where(eq(organizations.id, orgId));
    }
    if (otherOrgId) {
      await db.delete(organizations).where(eq(organizations.id, otherOrgId));
    }
    if (userId) {
      await db.delete(users).where(eq(users.id, userId));
    }
    await client.end();
  });

  it('enforces UNIQUE(name, version) for prompt versions', async () => {
    await expect(
      db.insert(promptVersions).values({
        name: promptName,
        version: 1,
        promptTemplate: 'Duplicate version',
        isActive: false,
      }),
    ).rejects.toThrow();
  });

  it('updates ai_sessions.updated_at when session status changes', async () => {
    const [before] = await db.select().from(aiSessions).where(eq(aiSessions.id, sessionId));
    const previousUpdatedAt = before?.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 25));

    await db.update(aiSessions).set({ status: 'archived' }).where(eq(aiSessions.id, sessionId));

    const [after] = await db.select().from(aiSessions).where(eq(aiSessions.id, sessionId));
    expect(after?.status).toBe('archived');
    expect(after?.updatedAt.getTime()).toBeGreaterThan(previousUpdatedAt?.getTime() ?? 0);
  });

  it('supports threaded ai_messages within a session', async () => {
    const [userMessage] = await db
      .insert(aiMessages)
      .values({
        organizationId: orgId,
        sessionId,
        createdByUserId: userId,
        role: 'user',
        content: 'What are the key takeaways?',
      })
      .returning();
    if (!userMessage) throw new Error('expected user AI message insert to return a row');
    userMessageId = userMessage.id;

    const [assistantMessage] = await db
      .insert(aiMessages)
      .values({
        organizationId: orgId,
        sessionId,
        parentMessageId: userMessageId,
        role: 'assistant',
        content: 'The document emphasizes accuracy and auditability.',
        status: 'completed',
        modelProvider: 'anthropic',
        modelName: 'claude-opus-4-7',
        inputTokens: 120,
        outputTokens: 48,
        totalTokens: 168,
        costMicroUsd: 4200,
      })
      .returning();
    if (!assistantMessage) {
      throw new Error('expected assistant AI message insert to return a row');
    }
    assistantMessageId = assistantMessage.id;

    expect(assistantMessage?.parentMessageId).toBe(userMessageId);
    expect(assistantMessage?.modelProvider).toBe('anthropic');
    expect(assistantMessage?.totalTokens).toBe(168);
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
    const [otherUserMessage] = await db
      .insert(aiMessages)
      .values({
        organizationId: otherOrgId,
        sessionId: otherSessionId,
        createdByUserId: userId,
        role: 'user',
        content: 'Other org parent message',
      })
      .returning();
    if (!otherUserMessage) {
      throw new Error('expected other user AI message insert to return a row');
    }
    otherUserMessageId = otherUserMessage.id;

    await expect(
      db.insert(aiMessages).values({
        organizationId: orgId,
        sessionId,
        parentMessageId: otherUserMessageId,
        role: 'assistant',
        content: 'This should fail because the parent belongs to another session',
      }),
    ).rejects.toThrow();
  });

  it('records rate_limit_events for AI endpoints', async () => {
    const [event] = await db
      .insert(rateLimitEvents)
      .values({
        organizationId: orgId,
        userId,
        endpoint: '/api/ai/chat',
        limitKey: `org:${orgId}:ai_chat`,
        action: 'allowed',
        tokensConsumed: 1,
        metadata: { feature: 'ai_messages' },
      })
      .returning();
    if (!event) throw new Error('expected rate limit event insert to return a row');
    rateLimitEventId = event.id;
    expect(event?.action).toBe('allowed');
    expect(event?.endpoint).toBe('/api/ai/chat');
    expect(event?.createdAt).toBeInstanceOf(Date);
  });
});
