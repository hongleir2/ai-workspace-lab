-- ERD §5.3 specifies CHECK constraints for role and status.  We use Postgres
-- ENUMs instead: they enforce the same value restriction at the DB level and
-- give Drizzle a typed pgEnum in the application layer.  Trade-off: adding a
-- new value requires ALTER TYPE ... ADD VALUE (irreversible once committed).
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');
--> statement-breakpoint

CREATE TYPE "public"."membership_status" AS ENUM('active', 'invited', 'suspended', 'removed');
--> statement-breakpoint

CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES organizations(id),
	"user_id" uuid NOT NULL REFERENCES users(id),
	"role" "member_role" NOT NULL,
	"status" "membership_status" NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "org_memberships_org_user_unique" ON "organization_memberships" USING btree ("organization_id", "user_id");
--> statement-breakpoint

CREATE INDEX "org_memberships_user_org_idx" ON "organization_memberships" USING btree ("user_id", "organization_id");
--> statement-breakpoint

CREATE INDEX "org_memberships_org_role_idx" ON "organization_memberships" USING btree ("organization_id", "role");
--> statement-breakpoint

CREATE INDEX "org_memberships_org_status_idx" ON "organization_memberships" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON organization_memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- RLS policy design for organization_memberships:
--
-- INSERT / UPDATE / DELETE: intentionally no policies for the authenticated role.
--   Membership writes (inviting, promoting, revoking) must go through the server
--   using the service role so that server-side authorization is enforced before
--   any membership state changes. Absence of a policy = deny for authenticated role.
--
-- SELECT: users may read their own membership row regardless of status, so they
--   can discover their role and membership state within the app.

-- Authenticated users can read their own memberships.
CREATE POLICY "memberships_select_own"
  ON organization_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = organization_memberships.user_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
    )
  );
--> statement-breakpoint

-- Active members can read the organization row.
-- Deferred here (not in 0002) because this policy body references
-- organization_memberships, which did not exist during migration 0002.
CREATE POLICY "organizations_select_member"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = organizations.id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
