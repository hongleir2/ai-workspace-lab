-- Day 46 / Sprint 8: AI chat MVP tables (prompt versions, sessions, messages)
-- plus an optional persistent rate-limit event log.

CREATE TYPE "public"."ai_session_visibility" AS ENUM('private', 'organization', 'shared');
--> statement-breakpoint

CREATE TYPE "public"."ai_session_status" AS ENUM('active', 'archived', 'deleted');
--> statement-breakpoint

CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant', 'system', 'tool');
--> statement-breakpoint

CREATE TYPE "public"."ai_message_status" AS ENUM('streaming', 'completed', 'failed', 'canceled');
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
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "prompt_versions_name_version_unique" UNIQUE("name", "version")
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

CREATE INDEX "ai_sessions_org_created_at_idx" ON "ai_sessions" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_sessions_created_by_created_at_idx" ON "ai_sessions" USING btree ("created_by_user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_sessions_org_status_idx" ON "ai_sessions" USING btree ("organization_id", "status");
--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ai_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
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

CREATE INDEX "ai_messages_org_session_created_at_idx" ON "ai_messages" USING btree ("organization_id", "session_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_messages_session_created_at_idx" ON "ai_messages" USING btree ("session_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_messages_org_created_at_idx" ON "ai_messages" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "ai_messages_model_provider_model_name_idx" ON "ai_messages" USING btree ("model_provider", "model_name");
--> statement-breakpoint

CREATE TABLE "rate_limit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES organizations(id),
  "user_id" uuid REFERENCES users(id),
  "endpoint" text NOT NULL,
  "limit_key" text NOT NULL,
  "action" text NOT NULL,
  "tokens_consumed" integer,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "rate_limit_events_org_created_at_idx" ON "rate_limit_events" USING btree ("organization_id", "created_at");
--> statement-breakpoint

CREATE INDEX "rate_limit_events_user_created_at_idx" ON "rate_limit_events" USING btree ("user_id", "created_at");
--> statement-breakpoint

CREATE INDEX "rate_limit_events_endpoint_created_at_idx" ON "rate_limit_events" USING btree ("endpoint", "created_at");
--> statement-breakpoint

CREATE INDEX "rate_limit_events_action_created_at_idx" ON "rate_limit_events" USING btree ("action", "created_at");
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

CREATE POLICY "ai_sessions_select_org_member"
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

CREATE POLICY "ai_messages_select_org_member"
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

CREATE POLICY "rate_limit_events_select_org_member"
  ON rate_limit_events FOR SELECT
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = rate_limit_events.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
--> statement-breakpoint

INSERT INTO "prompt_versions" (
  "name",
  "version",
  "prompt_template",
  "default_model_provider",
  "default_model_name",
  "is_active",
  "created_by_user_id"
)
VALUES
  (
    'document_qa',
    1,
    $$You are an assistant answering questions about a document.

Use only the supplied context to answer.
If the answer is not in the context, say you could not find it in the document.
Be concise and cite supporting passages when available.

Question:
{{question}}

Context:
{{context}}$$,
    NULL,
    NULL,
    true,
    NULL
  ),
  (
    'general_chat',
    1,
    $$You are a helpful assistant.

Answer clearly and directly.
Ask a clarifying question when the request is ambiguous.
If you are uncertain, say so instead of inventing facts.$$,
    NULL,
    NULL,
    true,
    NULL
  )
ON CONFLICT ("name", "version") DO NOTHING;
