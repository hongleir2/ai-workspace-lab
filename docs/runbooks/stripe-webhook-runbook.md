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

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Log in
stripe login

# Forward to local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# In another terminal, trigger a test event
stripe trigger customer.subscription.created
```
