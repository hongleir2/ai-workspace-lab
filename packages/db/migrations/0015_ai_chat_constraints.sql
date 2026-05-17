-- Day 46 conflict-resolution follow-up: preserve existing 0014 migration history,
-- then add the stricter AI chat integrity constraints from PR #36.
DO $$
BEGIN
  CREATE TYPE "public"."rate_limit_action" AS ENUM('allowed', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "rate_limit_events"
  ALTER COLUMN "action" TYPE "rate_limit_action"
  USING "action"::"rate_limit_action";
--> statement-breakpoint

ALTER TABLE "ai_sessions"
  ADD CONSTRAINT "ai_sessions_id_org_unique" UNIQUE ("id", "organization_id");
--> statement-breakpoint

ALTER TABLE "ai_messages"
  DROP CONSTRAINT IF EXISTS "ai_messages_parent_message_id_fkey";
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
