CREATE TABLE "ai_message_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "ai_message_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "document_chunk_id" uuid NOT NULL,
  "relevance_score" numeric(5, 4),
  "citation_label" text,
  "quote_start_char" integer,
  "quote_end_char" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_message_sources_message_chunk_unique" UNIQUE ("ai_message_id", "document_chunk_id")
);

ALTER TABLE "ai_message_sources" ADD CONSTRAINT "ai_message_sources_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "ai_message_sources" ADD CONSTRAINT "ai_message_sources_ai_message_id_ai_messages_id_fk"
  FOREIGN KEY ("ai_message_id") REFERENCES "public"."ai_messages"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "ai_message_sources" ADD CONSTRAINT "ai_message_sources_document_id_documents_id_fk"
  FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "ai_message_sources" ADD CONSTRAINT "ai_message_sources_document_chunk_id_document_chunks_id_fk"
  FOREIGN KEY ("document_chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "ai_message_sources_message_id_idx" ON "ai_message_sources" ("ai_message_id");
CREATE INDEX "ai_message_sources_org_id_idx" ON "ai_message_sources" ("organization_id");

-- RLS enabled; no SELECT policy is defined yet — all reads via non-service-role are denied by default.
-- A policy scoped to organization_id will be added when this table is exposed via the public API (ADR-0013 follow-up).
ALTER TABLE "ai_message_sources" ENABLE ROW LEVEL SECURITY;
