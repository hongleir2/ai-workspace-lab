ALTER TABLE "ai_sessions" ADD COLUMN "document_id" uuid;

ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_document_id_documents_id_fk"
  FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL ON UPDATE no action;

CREATE INDEX "ai_sessions_document_id_idx" ON "ai_sessions" ("document_id");
