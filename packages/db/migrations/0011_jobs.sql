-- ERD §9.1 — Background job queue state.
CREATE TYPE "public"."job_status" AS ENUM(
  'pending',
  'processing',
  'retrying',
  'completed',
  'failed',
  'dead_lettered',
  'canceled'
);
--> statement-breakpoint

CREATE TABLE "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES organizations(id),
  "created_by_user_id" uuid REFERENCES users(id),
  "job_type" text NOT NULL,
  "status" "job_status" NOT NULL DEFAULT 'pending',
  "payload" jsonb NOT NULL DEFAULT '{}',
  "idempotency_key" text NOT NULL,
  "attempts_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "run_after" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_by" text,
  "locked_at" timestamp with time zone,
  "last_error_code" text,
  "last_error_message" text,
  "completed_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "dead_lettered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint

CREATE INDEX "jobs_status_run_after_idx" ON "jobs" USING btree ("status", "run_after");
--> statement-breakpoint

CREATE INDEX "jobs_org_status_idx" ON "jobs" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- SELECT: active org members may read jobs belonging to their org.
-- System jobs (organization_id IS NULL) are not exposed via RLS.
CREATE POLICY "jobs_select_org_member"
  ON jobs FOR SELECT
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = jobs.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
