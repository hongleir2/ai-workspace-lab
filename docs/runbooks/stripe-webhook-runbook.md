# Stripe Webhook Runbook

## Symptoms and Responses

### Webhook endpoint returning 503
**Cause:** `STRIPE_WEBHOOK_SECRET` env var is missing.
**Fix:** Set `STRIPE_WEBHOOK_SECRET` in the deployment environment. Rotate the secret in the Stripe dashboard if it was ever exposed. Re-deploy. Stripe will automatically retry failed deliveries.

### Webhook endpoint returning 400 ("Invalid signature")
**Cause:** Wrong webhook secret, or the raw body was modified before signature verification (e.g., body parser middleware consumed the stream).
**Fix:** Confirm `STRIPE_WEBHOOK_SECRET` matches the secret for the correct Stripe webhook endpoint (Dashboard → Developers → Webhooks). Confirm the Next.js route reads `request.text()` before any middleware transforms the body.

### Webhook endpoint returning 500 ("Processing failed")
**Cause:** The handler threw an error after signature verification. The `stripe_events` row will have `processing_status = 'failed'` and an `error_message`.
**Fix:**
1. Query `stripe_events WHERE processing_status = 'failed' ORDER BY received_at DESC LIMIT 20` to find failing events.
2. Read `error_message` to diagnose (common: missing billing customer, unrecognized subscription status).
3. Fix the root cause (e.g., create the missing `billing_customers` row).
4. Re-deliver the event from the Stripe dashboard (Dashboard → Developers → Webhooks → select endpoint → find event → Resend). The resent event gets a new event ID, bypasses the dedup gate, and is processed fresh.

### Subscription stuck in `processing` state
**Cause:** The handler crashed after inserting the `stripe_events` row but before updating to `processed`.
**Fix:**
1. Find stuck rows: `SELECT * FROM stripe_events WHERE processing_status = 'processing' AND received_at < now() - interval '5 minutes'`.
2. Manually set `processing_status = 'failed'` with a descriptive `error_message`.
3. Re-deliver the original event from the Stripe dashboard.

### Subscription not created after checkout
**Cause:** One of: (a) `checkout.session.completed` event not delivered, (b) billing customer row missing for the Stripe customer ID, (c) the event failed and is in `stripe_events` with `processing_status = 'failed'`.
**Fix:**
1. Check the Stripe dashboard webhook log for the checkout session's events.
2. Query `stripe_events WHERE stripe_event_id = '<evt_xxx>'` to see processing status.
3. If missing billing customer: check `billing_customers` for the `stripe_customer_id`. If absent, the customer was created in Stripe but not synced — create the row manually and re-deliver the event.

## Monitoring

Set up alerts for:
- `stripe_events WHERE processing_status = 'failed'` — any row is actionable
- `stripe_events WHERE processing_status = 'processing' AND received_at < now() - interval '5 minutes'` — stuck processing

## Testing Webhooks Locally

### One-time setup

```bash
# 1. Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# 2. Log in (opens browser)
stripe login

# 3. Start webhook forwarding — prints a whsec_... signing secret
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` secret into `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...          # from stripe listen output
STRIPE_SECRET_KEY=sk_test_...            # Stripe dashboard → Developers → API keys
STRIPE_PRO_MONTHLY_PRICE_ID=price_...   # Stripe dashboard → Products
STRIPE_PRO_YEARLY_PRICE_ID=price_...
```

### Test a checkout flow (frontend)

1. Start the app: `pnpm dev`
2. Go to `http://localhost:3000/app/<your-org>/settings/billing`
3. Click **Upgrade** → Stripe Checkout opens in test mode
4. Use test card `4242 4242 4242 4242`, any future expiry, any CVC
5. Complete checkout → you land on `/settings/billing/success`
6. Watch the `stripe listen` terminal — `checkout.session.completed` and `customer.subscription.created` events appear as `[processed]`
7. Return to the billing page — plan should now show Pro

### Test the canceled flow

On the Stripe Checkout page, click **Back** → you land on `/settings/billing/canceled` (no charge made).

### Test webhook idempotency

```bash
# Get an event ID from the stripe listen output (e.g. evt_xxx), then resend it
stripe events resend evt_xxx
```

The second delivery returns `{"received":true}` but no new row is written to `stripe_events` — confirm via Supabase Studio at `http://localhost:54323`.

### Trigger individual event types

```bash
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
stripe trigger invoice.payment_succeeded
```

### Verify processing in the database

```sql
-- Check recent webhook events
SELECT stripe_event_id, event_type, processing_status, error_message, received_at
FROM stripe_events
ORDER BY received_at DESC
LIMIT 20;

-- Check subscription state
SELECT status, plan_id, current_period_end, cancel_at_period_end
FROM subscriptions
WHERE organization_id = '<your-org-uuid>';
```
