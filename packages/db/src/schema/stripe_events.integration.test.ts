import * as schema from '@ai-workspace-lab/db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { stripeEvents } from './stripe_events';

const DATABASE_URL = process.env['DATABASE_URL'];

describe.skipIf(!DATABASE_URL)('stripe_events schema', () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skipIf(!DATABASE_URL) above
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  const testEventId = `evt_test_day26_${Date.now()}`;
  const minimalPayload = { id: testEventId, type: 'checkout.session.completed', object: 'event' };

  afterAll(async () => {
    await db.delete(stripeEvents).where(eq(stripeEvents.stripeEventId, testEventId));
    await db.delete(stripeEvents).where(eq(stripeEvents.stripeEventId, `${testEventId}_fail`));
    await db
      .delete(stripeEvents)
      .where(eq(stripeEvents.stripeEventId, `${testEventId}_bad_status`));
    await client.end();
  });

  it('inserts a stripe event with default received_at and processing_status', async () => {
    const before = new Date();

    const [row] = await db
      .insert(stripeEvents)
      .values({
        stripeEventId: testEventId,
        eventType: 'checkout.session.completed',
        payload: minimalPayload,
        // receivedAt intentionally omitted -- should default to now()
      })
      .returning();

    expect(row).toBeDefined();
    expect(row?.stripeEventId).toBe(testEventId);
    expect(row?.processingStatus).toBe('received');
    expect(row?.processedAt).toBeNull();
    expect(row?.receivedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('rejects duplicate stripe_event_id (idempotency)', async () => {
    await expect(
      db.insert(stripeEvents).values({
        stripeEventId: testEventId,
        eventType: 'checkout.session.completed',
        payload: minimalPayload,
      }),
    ).rejects.toThrow();
  });

  it('allows status transition: received -> processing', async () => {
    const [updated] = await db
      .update(stripeEvents)
      .set({ processingStatus: 'processing' })
      .where(eq(stripeEvents.stripeEventId, testEventId))
      .returning();
    expect(updated?.processingStatus).toBe('processing');
  });

  it('allows status transition: processing -> processed with processedAt', async () => {
    const now = new Date();
    const [updated] = await db
      .update(stripeEvents)
      .set({ processingStatus: 'processed', processedAt: now })
      .where(eq(stripeEvents.stripeEventId, testEventId))
      .returning();
    expect(updated?.processingStatus).toBe('processed');
    expect(updated?.processedAt).toBeDefined();
  });

  it('allows status transition to failed with error_message', async () => {
    const [row] = await db
      .insert(stripeEvents)
      .values({
        stripeEventId: `${testEventId}_fail`,
        eventType: 'customer.subscription.deleted',
        payload: minimalPayload,
        processingStatus: 'failed',
        errorMessage: 'unknown subscription id',
      })
      .returning();
    expect(row?.processingStatus).toBe('failed');
    expect(row?.errorMessage).toBe('unknown subscription id');
  });

  it('rejects invalid processing_status (CHECK constraint)', async () => {
    await expect(
      db.insert(stripeEvents).values({
        stripeEventId: `${testEventId}_bad_status`,
        eventType: 'checkout.session.completed',
        payload: minimalPayload,
        processingStatus: 'done' as unknown as 'received',
      }),
    ).rejects.toThrow();
  });
});
