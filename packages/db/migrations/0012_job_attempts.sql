-- ERD §9.2 — Attempt-level observability for background jobs.
CREATE TYPE "public"."job_attempt_status" AS ENUM(
  'started',
  'succeeded',
  'failed',
  'timed_out'
);
--> statement-breakpoint

CREATE TABLE "job_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES jobs(id),
  "attempt_number" integer NOT NULL,
  "status" "job_attempt_status" NOT NULL DEFAULT 'started',
  "error_code" text,
  "error_message" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "ended_at" timestamp with time zone,
  CONSTRAINT "job_attempts_job_id_attempt_number_unique" UNIQUE("job_id", "attempt_number")
);
--> statement-breakpoint

CREATE INDEX "job_attempts_job_id_idx" ON "job_attempts" USING btree ("job_id");
--> statement-breakpoint

ALTER TABLE "job_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- SELECT: active org members may read attempts for jobs belonging to their org.
-- System jobs (organization_id IS NULL) are not exposed via RLS.
CREATE POLICY "job_attempts_select_org_member"
  ON job_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN organization_memberships om ON om.organization_id = j.organization_id
      JOIN users u ON u.id = om.user_id
      WHERE j.id = job_attempts.job_id
        AND j.organization_id IS NOT NULL
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
