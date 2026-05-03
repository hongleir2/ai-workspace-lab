CREATE TYPE "public"."org_status" AS ENUM('active', 'suspended', 'deleted');
--> statement-breakpoint

CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" "citext" NOT NULL,
	"owner_user_id" uuid REFERENCES users(id),
	"status" "org_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");
--> statement-breakpoint

CREATE INDEX "organizations_owner_user_id_idx" ON "organizations" USING btree ("owner_user_id");
--> statement-breakpoint

CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
-- RLS policy design for organizations:
--
-- SELECT: added in 0003_organization_memberships.sql after the organization_memberships
--   table exists (the policy body references it — Postgres validates at creation time).
--
-- INSERT / UPDATE / DELETE: intentionally no policies for the authenticated role.
--   All org writes go through the server using the Supabase service role, which
--   bypasses RLS entirely. Allowing authenticated-role writes would mean any signed-in
--   user could mutate any org row directly via the REST API without going through
--   server-side authorization. Absence of a policy = deny for authenticated role.
