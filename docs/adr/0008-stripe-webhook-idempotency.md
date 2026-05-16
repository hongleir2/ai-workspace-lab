# 0008 — Stripe Webhook Idempotency via stripe_events Table

## Status
Accepted

## Context
Stripe delivers webhooks at-least-once. Without deduplication, duplicate deliveries can create duplicate subscriptions, double-cancel a subscription, or mark an already-active subscription as past-due a second time — all real money incidents.

## Decision
Every inbound Stripe event is inserted into `stripe_events` with `ON CONFLICT (stripe_event_id) DO NOTHING`. If the insert returns no row, the event is a duplicate and the handler returns immediately with no side effects. The insert is the atomic gate; no application-level locking or Redis deduplication is needed.

The handler also tracks processing state (`received → processing → processed | failed`) so that ops can identify stuck or failed events without querying Stripe's dashboard.

## Consequences
- **Idempotency is guaranteed at the DB level.** A duplicate event cannot produce a second subscription row or a second status transition because the gate is a unique constraint, not application logic.
- **The `stripe_events` table is append-only in practice.** A failed event is retried by Stripe; the retry gets a new event ID from Stripe, bypasses the dedup gate, and is processed fresh. The old failed row remains for ops visibility.
- **Signature verification is the first gate; idempotency is the second.** The webhook route rejects unsigned requests before any DB write.
- **Trade-off accepted:** Processing state updates (`processing → processed/failed`) are not themselves atomic with dispatch. A crash between the status update and the dispatch completing would leave a row in `processing` state permanently. Ops should alert on rows older than 5 minutes in `processing` status.
