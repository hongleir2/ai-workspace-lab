-- Add missing index on plans.is_active (present in Drizzle schema but omitted from 0005).
-- Seed the 'free' plan row so createOrganization's FK on planId never fails in a
-- freshly migrated environment (staging, contributor clone, production).

CREATE INDEX IF NOT EXISTS "plans_is_active_idx" ON "plans" USING btree ("is_active");
--> statement-breakpoint

INSERT INTO "plans" ("id", "name", "billing_interval", "price_cents", "currency", "is_active", "sort_order")
VALUES ('free', 'Free', 'none', 0, 'usd', true, 0)
ON CONFLICT ("id") DO NOTHING;
