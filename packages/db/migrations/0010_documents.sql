-- ERD §8.2 — User-facing document record.
-- References storage_objects for the raw file; tracks async processing state.
CREATE TYPE "public"."document_status" AS ENUM(
  'uploaded',
  'queued',
  'processing',
  'chunking',
  'embedding',
  'indexed',
  'ready',
  'failed',
  'deleted'
);
--> statement-breakpoint

CREATE TYPE "public"."document_source_type" AS ENUM('web_upload', 'desktop_upload', 'api', 'url');
--> statement-breakpoint

CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES organizations(id),
	"storage_object_id" uuid NOT NULL REFERENCES storage_objects(id),
	"created_by_user_id" uuid NOT NULL REFERENCES users(id),
	"title" text NOT NULL,
	"source_type" "document_source_type" NOT NULL,
	"file_type" text NOT NULL,
	"status" "document_status" NOT NULL DEFAULT 'uploaded',
	"processing_error_code" text,
	"processing_error_message" text,
	"page_count" integer,
	"language" text,
	"checksum_sha256" text,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX "documents_org_status_idx" ON "documents" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE INDEX "documents_org_created_at_idx" ON "documents" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "documents_created_by_created_at_idx" ON "documents" USING btree ("created_by_user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "documents_checksum_idx" ON "documents" USING btree ("checksum_sha256");
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- INSERT / UPDATE / DELETE: no authenticated-role policies.
-- All writes go through the server via the service role.
-- SELECT: active org members may read documents belonging to their org.
CREATE POLICY "documents_select_org_member"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = documents.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
