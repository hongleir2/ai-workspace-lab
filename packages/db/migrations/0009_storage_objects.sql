-- ERD §8.1 — Metadata for files in R2 / Supabase Storage.
-- One row per uploaded file object. The document table references this.
CREATE TYPE "public"."storage_object_status" AS ENUM('uploaded', 'deleted', 'quarantined');
--> statement-breakpoint

CREATE TABLE "storage_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES organizations(id),
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" bigint NOT NULL CHECK (byte_size >= 0),
	"checksum_sha256" text,
	"uploaded_by_user_id" uuid NOT NULL REFERENCES users(id),
	"status" "storage_object_status" NOT NULL DEFAULT 'uploaded',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE UNIQUE INDEX "storage_objects_bucket_key_unique" ON "storage_objects" USING btree ("bucket", "object_key");
--> statement-breakpoint

CREATE INDEX "storage_objects_org_created_at_idx" ON "storage_objects" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "storage_objects_checksum_idx" ON "storage_objects" USING btree ("checksum_sha256");
--> statement-breakpoint

ALTER TABLE "storage_objects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- INSERT / UPDATE / DELETE: no authenticated-role policies.
-- All writes go through the server via the service role.
-- SELECT: active org members may read storage objects belonging to their org.
CREATE POLICY "storage_objects_select_org_member"
  ON storage_objects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = storage_objects.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
