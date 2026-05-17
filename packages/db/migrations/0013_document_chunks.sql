-- Enable pgvector extension for embedding storage and similarity search.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

-- ERD §8.6 — Searchable RAG chunks produced from processed documents.
CREATE TABLE "document_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES organizations(id),
  "document_id" uuid NOT NULL REFERENCES documents(id),
  "chunk_index" integer NOT NULL,
  "text" text NOT NULL,
  "token_count" integer,
  "page_start" integer,
  "page_end" integer,
  "section_title" text,
  "embedding" vector(1536),
  "embedding_model" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_chunks_document_id_chunk_index_unique" UNIQUE("document_id", "chunk_index")
);
--> statement-breakpoint

CREATE INDEX "document_chunks_org_doc_idx" ON "document_chunks" USING btree ("organization_id", "document_id");
--> statement-breakpoint

CREATE INDEX "document_chunks_org_created_at_idx" ON "document_chunks" USING btree ("organization_id", "created_at");
--> statement-breakpoint

-- HNSW index for approximate nearest-neighbour similarity search (cosine distance).
-- Required for sub-linear RAG retrieval; sequential scan is unusable at scale.
CREATE INDEX "document_chunks_embedding_hnsw_idx"
  ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
--> statement-breakpoint

ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- SELECT: active org members may read chunks belonging to their org.
CREATE POLICY "document_chunks_select_org_member"
  ON document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = document_chunks.organization_id
        AND u.auth_provider = 'supabase'
        AND u.auth_provider_user_id = auth.uid()::text
        AND om.status = 'active'
    )
  );
