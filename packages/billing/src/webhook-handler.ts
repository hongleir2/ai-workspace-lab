import {
  type Database,
  and,
  billingCustomers,
  db,
  eq,
  stripeEvents,
  subscriptions,
} from '@ai-workspace-lab/db';
import type Stripe from 'stripe';
import { mapStripePriceToPlan } from './service';
import { stripe } from './stripe';

type SubscriptionStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired';

const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: 'active',
  past_due: 'past_due',
  unpaid: 'unpaid',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  trialing: 'trialing',
};

export async function handleStripeEvent(event: Stripe.Event, dbConn: Database = db): Promise<void> {
  const [eventRow] = await dbConn
    .insert(stripeEvents)
    .values({
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning();

  if (!eventRow) return;

  await dbConn
    .update(stripeEvents)
    .set({ processingStatus: 'processing' })
    .where(eq(stripeEvents.id, eventRow.id));

  try {
    await dispatch(event, dbConn);
    await dbConn
      .update(stripeEvents)
      .set({ processingStatus: 'processed', processedAt: new Date() })
      .where(eq(stripeEvents.id, eventRow.id));
  } catch (err) {
    await dbConn
      .update(stripeEvents)
      .set({
        processingStatus: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(stripeEvents.id, eventRow.id));
    throw err;
  }
}

async function dispatch(event: Stripe.Event, dbConn: Database): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription' || !session.subscription) return;
      const subId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      return upsertSubscription(sub, dbConn);
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return upsertSubscription(event.data.object as Stripe.Subscription, dbConn);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription, dbConn);
    case 'invoice.payment_failed':
      return handlePaymentFailed(event.data.object as Stripe.Invoice, dbConn);
    case 'invoice.payment_succeeded':
      return handlePaymentSucceeded(event.data.object as Stripe.Invoice, dbConn);
    default:
      return;
  }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails?.subscription) return null;
  const sub = subDetails.subscription;
  return typeof sub === 'string' ? sub : sub.id;
}

async function upsertSubscription(sub: Stripe.Subscription, dbConn: Database): Promise<void> {
  const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const [billingCustomer] = await dbConn
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!billingCustomer) {
    throw new Error(`No billing customer for Stripe customer ${stripeCustomerId}`);
  }

  const firstItem = sub.items.data[0];
  const priceId = firstItem?.price.id ?? '';
  const plan = priceId ? await mapStripePriceToPlan(priceId, dbConn) : null;
  const planId = plan?.id ?? 'free';
  const status = STRIPE_STATUS_MAP[sub.status];
  if (!status) throw new Error(`Unrecognized Stripe subscription status: ${sub.status}`);

  // current_period_start/end live on SubscriptionItem in Stripe v22
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : undefined;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : undefined;

  const shared = {
    planId,
    ...(priceId ? { stripePriceId: priceId } : {}),
    status,
    ...(periodStart !== undefined ? { currentPeriodStart: periodStart } : {}),
    ...(periodEnd !== undefined ? { currentPeriodEnd: periodEnd } : {}),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    ...(sub.canceled_at !== null ? { canceledAt: new Date(sub.canceled_at * 1000) } : {}),
    ...(sub.ended_at !== null ? { endedAt: new Date(sub.ended_at * 1000) } : {}),
    ...(sub.trial_end !== null ? { trialEnd: new Date(sub.trial_end * 1000) } : {}),
  };

  await dbConn
    .insert(subscriptions)
    .values({
      organizationId: billingCustomer.organizationId,
      billingCustomerId: billingCustomer.id,
      stripeSubscriptionId: sub.id,
      seats: 1,
      ...shared,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: { ...shared, updatedAt: new Date() },
    });
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  dbConn: Database,
): Promise<void> {
  await dbConn
    .update(subscriptions)
    .set({
      status: 'canceled',
      ...(sub.canceled_at !== null
        ? { canceledAt: new Date(sub.canceled_at * 1000) }
        : { canceledAt: new Date() }),
      ...(sub.ended_at !== null
        ? { endedAt: new Date(sub.ended_at * 1000) }
        : { endedAt: new Date() }),
    })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));
}

async function handlePaymentFailed(invoice: Stripe.Invoice, dbConn: Database): Promise<void> {
  const subId = getInvoiceSubscriptionId(invoice);
  if (!subId) return;
  await dbConn
    .update(subscriptions)
    .set({ status: 'past_due' })
    .where(eq(subscriptions.stripeSubscriptionId, subId));
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice, dbConn: Database): Promise<void> {
  const subId = getInvoiceSubscriptionId(invoice);
  if (!subId) return;
  await dbConn
    .update(subscriptions)
    .set({ status: 'active' })
    .where(
      and(eq(subscriptions.stripeSubscriptionId, subId), eq(subscriptions.status, 'past_due')),
    );
}
