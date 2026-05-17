-- ERD §10.1–§10.3 and §7.3 — AI prompt versions, sessions, messages, and optional rate-limit log.
CREATE TYPE "public"."ai_session_visibility" AS ENUM('private', 'organization', 'shared');
--> statement-breakpoint

CREATE TYPE "public"."ai_session_status" AS ENUM('active', 'archived', 'deleted');
--> statement-breakpoint

CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant', 'system', 'tool');
--> statement-breakpoint

CREATE TYPE "public"."ai_message_status" AS ENUM('streaming', 'completed', 'failed', 'canceled');
--> statement-breakpoint

CREATE TYPE "public"."rate_limit_action" AS ENUM('allowed', 'blocked');
--> statement-breakpoint

CREATE TABLE "prompt_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "version" integer NOT NULL,
  "prompt_template" text NOT NULL,
  "default_model_provider" text,
  "default_model_name" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by_user_id" uuid REFERENCES users(id),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "ai_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES organizations(id),
  "created_by_user_id" uuid NOT NULL REFERENCES users(id),
  "prompt_version_id" uuid REFERENCES prompt_versions(id),
  "title" text,
  "visibility" "ai_session_visibility" NOT NULL DEFAULT 'private',
  "status" "ai_session_status" NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE "ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES organizations(id),
  "session_id" uuid NOT NULL REFERENCES ai_sessions(id),
  "parent_message_id" uuid REFERENCES ai_messages(id),
  "created_by_user_id" uuid REFERENCES users(id),
  "role" "ai_message_role" NOT NULL,
  "content" text NOT NULL,
  "status" "ai_message_status" NOT NULL DEFAULT 'completed',
  "model_provider" text,
  "model_name" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "total_tokens" integer,
  "cost_micro_usd" bigint,
  "error_code" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE "rate_limit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES organizations(id),
  "user_id" uuid REFERENCES users(id),
  "endpoint" text NOT NULL,
  "limit_key" text NOT NULL,
  "action" "rate_limit_action" NOT NULL,
  "tokens_consumed" integer,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "prompt_versions_name_version_unique" ON "prompt_versions" USING btree ("name", "version");
--> statement-breakpoint

ALTER TABLE "ai_sessions"
  ADD CONSTRAINT "ai_sessions_id_org_unique" UNIQUE ("id", "organization_id");
--> statement-breakpoint

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_id_session_org_unique" UNIQUE ("id", "session_id", "organization_id");
--> statement-breakpoint

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_session_org_fk"
  FOREIGN KEY ("session_id", "organization_id")
  REFERENCES "ai_sessions" ("id", "organization_id");
--> statement-breakpoint

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_parent_same_session_fk"
  FOREIGN KEY ("parent_message_id", "session_id", "organization_id")
  REFERENCES "ai_messages" ("id", "session_id", "organization_id");
--> statement-breakpoint

INSERT INTO "prompt_versions" (
  "name",
  "version",
  "prompt_template",
  "default_model_provider",
  "default_model_name",
  "is_active"
)
VALUES
  (
    'document_qa',
    1,
    'Answer the user using the provided document context when available. If the answer is not supported by the documents, say that clearly.',
    NULL,
    NULL,
    true
  ),
  (
    'general_chat',
    1,
    'You are a helpful AI workspace assistant. Give concise, accurate answers and ask for clarification when the request is ambiguous.',
    NULL,
    NULL,
    true
  )
ON CONFLICT ("name", "version") DO UPDATE
SET
  "prompt_template" = EXCLUDED."prompt_template",
  "default_model_provider" = EXCLUDED."default_model_provider",
  "default_model_name" = EXCLUDED."default_model_name",
  "is_active" = EXCLUDED."is_active";
--> statement-breakpoint

CREATE INDEX "ai_sessions_org_created_at_idx" ON "ai_sessions" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_sessions_created_by_created_at_idx" ON "ai_sessions" USING btree ("created_by_user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_sessions_org_status_idx" ON "ai_sessions" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE INDEX "ai_messages_org_session_created_at_idx" ON "ai_messages" USING btree ("organization_id", "session_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_messages_session_created_at_idx" ON "ai_messages" USING btree ("session_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_messages_org_created_at_idx" ON "ai_messages" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_messages_model_provider_name_idx" ON "ai_messages" USING btree ("model_provider", "model_name");
--> statement-breakpoint

CREATE INDEX "rate_limit_events_org_created_at_idx" ON "rate_limit_events" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "rate_limit_events_user_created_at_idx" ON "rate_limit_events" USING btree ("user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "rate_limit_events_endpoint_created_at_idx" ON "rate_limit_events" USING btree ("endpoint", "created_at");
--> statement-breakpoint

CREATE INDEX "rate_limit_events_action_created_at_idx" ON "rate_limit_events" USING btree ("action", "created_at");
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ai_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

ALTER TABLE "prompt_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "ai_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "rate_limit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "prompt_versions_select_authenticated"
  ON prompt_versions FOR SELECT
  TO authenticated
  USING (true);
--> statement-breakpoint

CREATE POLICY "ai_sessions_select_member"
  ON ai_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ai_sessions.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
--> statement-breakpoint

CREATE POLICY "ai_messages_select_member"
  ON ai_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ai_messages.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
--> statement-breakpoint

CREATE POLICY "rate_limit_events_select_member"
  ON rate_limit_events FOR SELECT
  USING (
    organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = rate_limit_events.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
