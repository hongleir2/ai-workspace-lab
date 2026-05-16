-- Day 26: billing_customers (org <> Stripe customer bridge) and
-- stripe_events (webhook idempotency log). Also wires the FK on
-- subscriptions.billing_customer_id that was deferred from migration 0005.

CREATE TABLE "billing_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "stripe_customer_id" text NOT NULL,
  "billing_email" citext,
  "created_by_user_id" uuid REFERENCES users(id) ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "stripe_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stripe_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "processing_status" text NOT NULL DEFAULT 'received',
  "payload" jsonb NOT NULL,
  "error_message" text,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stripe_events_processing_status_check"
    CHECK ("processing_status" IN ('received', 'processing', 'processed', 'failed'))
);
--> statement-breakpoint

-- Wire the FK that was deferred in migration 0005.
-- ON DELETE SET NULL: deleting a billing customer row orphans the subscription
-- rather than cascading a delete of billing history.
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_billing_customer_id_fkey"
  FOREIGN KEY ("billing_customer_id")
  REFERENCES "billing_customers"("id")
  ON DELETE SET NULL;
--> statement-breakpoint

-- billing_customers indexes
CREATE UNIQUE INDEX "billing_customers_org_unique" ON "billing_customers" ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_stripe_id_unique" ON "billing_customers" ("stripe_customer_id");
--> statement-breakpoint
CREATE INDEX "billing_customers_created_at_idx" ON "billing_customers" ("created_at");
--> statement-breakpoint

-- stripe_events indexes -- idempotency is the critical constraint
CREATE UNIQUE INDEX "stripe_events_stripe_event_id_unique" ON "stripe_events" ("stripe_event_id");
--> statement-breakpoint
CREATE INDEX "stripe_events_event_type_idx" ON "stripe_events" ("event_type");
--> statement-breakpoint
CREATE INDEX "stripe_events_processing_status_idx" ON "stripe_events" ("processing_status");
--> statement-breakpoint
CREATE INDEX "stripe_events_received_at_idx" ON "stripe_events" ("received_at");
--> statement-breakpoint

-- Table-prefixed trigger name for clarity
CREATE TRIGGER billing_customers_set_updated_at
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- RLS
ALTER TABLE "billing_customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stripe_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- billing_customers: members of the org may read their own billing customer row.
CREATE POLICY "billing_customers_select_member"
  ON billing_customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = billing_customers.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
--> statement-breakpoint

-- stripe_events: no authenticated-role read or write policy.
-- All access via service role in webhook handlers only.
