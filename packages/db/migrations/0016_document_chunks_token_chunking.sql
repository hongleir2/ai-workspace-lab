-- ERD §8.6 — Add token-aware chunking metadata columns to document_chunks.
-- chunking_strategy identifies which algorithm produced the chunks so retrieval
-- can handle mixed-strategy corpora during rolling upgrades.
-- start_char_index / end_char_index record the new-content span (excluding overlap
-- preamble) in the original extracted text, enabling source highlighting.
ALTER TABLE "document_chunks"
  ADD COLUMN "chunking_strategy" text,
  ADD COLUMN "start_char_index" integer,
  ADD COLUMN "end_char_index" integer;
