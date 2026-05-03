CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid REFERENCES organizations(id),
	"actor_user_id" uuid REFERENCES users(id),
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"metadata" jsonb,
	"ip_address" inet,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "audit_logs_org_created_idx" ON "audit_logs" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type", "entity_id");
--> statement-breakpoint

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Active members can read their organization's audit logs.
-- Inserts are performed server-side via the service role, which bypasses RLS.
CREATE POLICY "audit_logs_select_member"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = audit_logs.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
