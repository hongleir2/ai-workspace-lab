-- Seed pro_monthly and pro_yearly plan rows so freshly migrated environments
-- (contributor clones, staging, CI) have the full plan catalog.
-- stripe_price_id is not set here — it is environment-specific and applied
-- per-environment via `pnpm db:seed` which reads STRIPE_PRO_*_PRICE_ID from env.

INSERT INTO "plans" ("id", "name", "billing_interval", "price_cents", "currency", "is_active", "sort_order")
VALUES
  ('pro_monthly', 'Pro (Monthly)', 'month', 1900,  'usd', true, 1),
  ('pro_yearly',  'Pro (Yearly)',  'year',  19000, 'usd', true, 2)
ON CONFLICT ("id") DO NOTHING;
