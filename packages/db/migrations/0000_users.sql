-- Enable citext extension for case-insensitive email comparisons.
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint

-- Shared trigger function that keeps updated_at current on every update.
-- Created once here; re-used by every subsequent table migration.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'deleted');
--> statement-breakpoint

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider" text NOT NULL,
	"auth_provider_user_id" text NOT NULL,
	"email" "citext" NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"timezone" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE UNIQUE INDEX "users_auth_provider_uid_unique" ON "users" USING btree ("auth_provider","auth_provider_user_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
--> statement-breakpoint

CREATE INDEX "users_status_idx" ON "users" USING btree ("status");
--> statement-breakpoint

CREATE INDEX "users_last_seen_at_idx" ON "users" USING btree ("last_seen_at");
--> statement-breakpoint

-- Keep updated_at current on every row update.
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- RLS: users see and update only their own row.
-- The service role bypasses RLS and is used for all server-side writes.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth_provider_user_id = auth.uid()::text);
--> statement-breakpoint

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth_provider_user_id = auth.uid()::text);
