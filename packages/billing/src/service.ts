import {
  type BillingCustomer,
  type Database,
  type Plan,
  billingCustomers,
  db,
  eq,
  plans,
} from '@ai-workspace-lab/db';
import { stripe } from './stripe';

export async function mapStripePriceToPlan(
  stripePriceId: string,
  dbConn: Database = db,
): Promise<Plan | null> {
  const [plan] = await dbConn
    .select()
    .from(plans)
    .where(eq(plans.stripePriceId, stripePriceId))
    .limit(1);
  return plan ?? null;
}

export async function getOrCreateStripeCustomer(
  organizationId: string,
  customerName: string,
  billingEmail: string | null,
  createdByUserId: string | null,
  dbConn: Database = db,
): Promise<BillingCustomer> {
  const [existing] = await dbConn
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, organizationId))
    .limit(1);

  if (existing) return existing;

  const stripeCustomer = await stripe.customers.create({
    name: customerName,
    ...(billingEmail !== null ? { email: billingEmail } : {}),
    metadata: { organizationId },
  });

  const [inserted] = await dbConn
    .insert(billingCustomers)
    .values({
      organizationId,
      stripeCustomerId: stripeCustomer.id,
      billingEmail: billingEmail ?? undefined,
      createdByUserId: createdByUserId ?? undefined,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;

  // Lost a concurrent-insert race — the unique constraint fired. Fetch the winner.
  const [winner] = await dbConn
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, organizationId))
    .limit(1);
  if (!winner) throw new Error('Failed to persist billing customer');
  return winner;
}

export async function createCheckoutSession(
  organizationId: string,
  priceId: string,
  orgSlug: string,
  customerName: string,
  billingEmail: string | null,
  userId: string,
  baseUrl: string,
  dbConn: Database = db,
): Promise<string> {
  const customer = await getOrCreateStripeCustomer(
    organizationId,
    customerName,
    billingEmail,
    userId,
    dbConn,
  );

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/app/${orgSlug}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/app/${orgSlug}/settings/billing/canceled`,
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return session.url;
}

export async function createBillingPortalSession(
  organizationId: string,
  orgSlug: string,
  baseUrl: string,
  dbConn: Database = db,
): Promise<string> {
  const [customer] = await dbConn
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, organizationId))
    .limit(1);

  if (!customer) throw new Error('No billing customer found — upgrade to a paid plan first');

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${baseUrl}/app/${orgSlug}/settings/billing`,
  });

  return session.url;
}
