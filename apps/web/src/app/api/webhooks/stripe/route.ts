import { logger } from '@/lib/axiom/server';
import { env } from '@/lib/env';
import { handleStripeEvent, stripe } from '@ai-workspace-lab/billing';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Prevent Next.js from caching this route.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = (await headers()).get('x-trace-id') ?? undefined;
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature') ?? '';
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    logger.warn('stripe.webhook.signature_invalid', { traceId });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info('stripe.webhook.received', {
    traceId,
    eventType: event.type,
    eventId: event.id,
  });

  try {
    await handleStripeEvent(event);
    logger.info('stripe.webhook.processed', {
      traceId,
      eventType: event.type,
      eventId: event.id,
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error('stripe.webhook.failed', {
      traceId,
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
