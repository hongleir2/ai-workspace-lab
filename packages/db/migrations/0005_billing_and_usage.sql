-- Day 21: billing tables (plans, plan_limits, subscriptions) and usage tables
-- (usage_events, usage_counters). billing_customers FK is deferred to Sprint 4.

CREATE TYPE "public"."billing_interval" AS ENUM('none', 'month', 'year');
--> statement-breakpoint

CREATE TYPE "public"."limit_unit" AS ENUM('count', 'mb', 'tokens', 'seats', 'bytes');
--> statement-breakpoint

CREATE TYPE "public"."reset_interval" AS ENUM('day', 'month', 'billing_period', 'none');
--> statement-breakpoint

CREATE TYPE "public"."subscription_status" AS ENUM('free', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired');
--> statement-breakpoint

CREATE TYPE "public"."usage_unit" AS ENUM('count', 'tokens', 'bytes', 'micro_usd');
--> statement-breakpoint

CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"billing_interval" "billing_interval" NOT NULL DEFAULT 'none',
	"price_cents" integer NOT NULL DEFAULT 0,
	"currency" text NOT NULL DEFAULT 'usd',
	"stripe_price_id" text,
	"is_active" boolean NOT NULL DEFAULT true,
	"sort_order" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "plan_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" text NOT NULL REFERENCES plans(id),
	"feature_key" text NOT NULL,
	"limit_value" integer,
	"limit_unit" "limit_unit" NOT NULL,
	"reset_interval" "reset_interval" NOT NULL,
	"hard_limit" boolean NOT NULL DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES organizations(id),
	"billing_customer_id" uuid,
	"plan_id" text NOT NULL REFERENCES plans(id),
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"status" "subscription_status" NOT NULL,
	"seats" integer NOT NULL DEFAULT 1,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean NOT NULL DEFAULT false,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES organizations(id),
	"user_id" uuid REFERENCES users(id),
	"feature_key" text NOT NULL,
	"event_type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"unit" "usage_unit" NOT NULL,
	"provider" text,
	"model_name" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"cost_micro_usd" bigint,
	"source_type" text,
	"source_id" uuid,
	"idempotency_key" text,
	"metadata" jsonb,
	"billing_period_start" timestamp with time zone,
	"billing_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES organizations(id),
	"feature_key" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"used_quantity" numeric NOT NULL DEFAULT 0,
	"limit_quantity" numeric,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "plans_stripe_price_id_unique" ON "plans" USING btree ("stripe_price_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "plan_limits_plan_feature_unique" ON "plan_limits" USING btree ("plan_id", "feature_key");
--> statement-breakpoint

CREATE INDEX "plan_limits_feature_key_idx" ON "plan_limits" USING btree ("feature_key");
--> statement-breakpoint

-- Partial unique index: allows historical rows (canceled, expired) while preventing
-- duplicate active subscriptions per org.
CREATE UNIQUE INDEX "subscriptions_active_org_unique" ON "subscriptions" ("organization_id")
  WHERE status IN ('active', 'trialing', 'free');
--> statement-breakpoint

CREATE UNIQUE INDEX "subscriptions_stripe_sub_unique" ON "subscriptions" USING btree ("stripe_subscription_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "usage_events_idempotency_key_unique" ON "usage_events" USING btree ("idempotency_key");
--> statement-breakpoint

CREATE UNIQUE INDEX "usage_counters_org_feature_period_unique" ON "usage_counters" USING btree ("organization_id", "feature_key", "period_start", "period_end");
--> statement-breakpoint

CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");
--> statement-breakpoint

CREATE INDEX "subscriptions_period_end_idx" ON "subscriptions" USING btree ("current_period_end");
--> statement-breakpoint

CREATE INDEX "usage_events_org_created_idx" ON "usage_events" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "usage_events_org_feature_created_idx" ON "usage_events" USING btree ("organization_id", "feature_key", "created_at");
--> statement-breakpoint

CREATE INDEX "usage_events_user_created_idx" ON "usage_events" USING btree ("user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "usage_counters_org_idx" ON "usage_counters" USING btree ("organization_id");
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON plan_limits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON usage_counters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "plan_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "usage_counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- plans and plan_limits are global reference data; any authenticated user may read them.
-- Writes are service-role only (no authenticated-role write policies).
CREATE POLICY "plans_select_authenticated"
  ON plans FOR SELECT
  TO authenticated
  USING (true);
--> statement-breakpoint

CREATE POLICY "plan_limits_select_authenticated"
  ON plan_limits FOR SELECT
  TO authenticated
  USING (true);
--> statement-breakpoint

CREATE POLICY "subscriptions_select_member"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = subscriptions.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
--> statement-breakpoint

CREATE POLICY "usage_events_select_member"
  ON usage_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = usage_events.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
--> statement-breakpoint

CREATE POLICY "usage_counters_select_member"
  ON usage_counters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = usage_counters.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
