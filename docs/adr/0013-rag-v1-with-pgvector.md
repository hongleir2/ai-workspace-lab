# 0013 — RAG v1 with pgvector

## Status
Accepted

## Context

Users want to ask questions about documents they have uploaded. A Retrieval-Augmented Generation (RAG) system allows the AI to ground its answers in the document's content rather than relying solely on its training data.

The stack already has:
- `pgvector` extension in Supabase Postgres (added in ADR 0007)
- `document_chunks` table with an `embedding` column (1536-dim, text-embedding-3-small)
- Background job that fills embeddings on document processing (Day 52)
- Streaming chat route (ADR 0012)

The question is where retrieval lives, how it integrates with the chat route, and what the audit trail for citations looks like.

## Decision

### Retrieval service (`@ai-workspace-lab/ai`)

- `embedQuery(text, apiKey)` — single-vector embed via `text-embedding-3-small`
- `retrieveRelevantChunks(orgId, embedding, opts)` — raw SQL cosine search via `<=>` operator; filters by `organization_id` first, then optional `documentId`, then similarity threshold (`minSimilarity` default 0.5, `topK` default 5)
- `buildContextBlock(chunks)` — formats chunks as numbered citations for prompt injection
- `validateRagScope(orgId, documentId)` — asserts the document exists and belongs to the org before any embedding work starts

The cosine threshold is 0.5 (conservative; avoids injecting irrelevant context). The similarity guard ensures that if no relevant chunks exist, no system prompt is injected and the model answers from its own knowledge.

### Chat route integration

The `POST /api/orgs/[orgSlug]/chat` route accepts an optional `documentId` field. When present:

1. Feature flag check (`rag_v1_enabled`) — gated the same way as `ai_chat_enabled`
2. `validateRagScope` — 404 if document does not belong to this org (cross-org isolation)
3. `embedQuery` on the last user message — non-fatal: if this fails, chat proceeds without context
4. `retrieveRelevantChunks` — cosine search against the org's chunks for that document
5. If chunks returned: inject a system prompt via `buildContextBlock`
6. In `onFinish`: insert `ai_message_sources` rows non-fatally (one per chunk)

No transaction wraps steps 3–6. If the sources insert fails, the chat response is already streamed to the user; the failure is logged as a warning and the answer stands.

### Citations table (`ai_message_sources`)

New table (migration 0017) linking assistant messages to the document chunks that were retrieved:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `organization_id` | uuid FK | for RLS / org-scoped queries |
| `ai_message_id` | uuid FK | the assistant message |
| `document_id` | uuid FK | the source document |
| `document_chunk_id` | uuid FK | the specific chunk |
| `relevance_score` | numeric(5,4) | cosine similarity at retrieval time |
| `citation_label` | text | `[1]`, `[2]`, … matching the context block |
| `quote_start_char` / `quote_end_char` | integer | reserved for future inline citation highlight |
| `created_at` | timestamptz | |

UNIQUE(ai_message_id, document_chunk_id) prevents duplicate inserts on retry.
RLS is enabled; policy to be added when the citations API is exposed client-side.

### UI

The `ChatInterface` component accepts an optional `documentId` and `documentName` prop. When set, it:
- Passes `documentId` in the `useChat` request body
- Shows a "Document context" badge in the chat header

Citation text is not yet surfaced in the streaming UI (future work).

## Consequences

**Accepted trade-offs:**
- No transaction around the retrieval + chat + insert pipeline — a crash between steps can leave a message without sources; this is acceptable at v1 since sources are for analytics, not correctness.
- Retrieval happens synchronously in the request path before streaming begins — adds latency (one embedding call + one SQL query) per RAG request. Acceptable for v1; can be parallelised with the entitlement check later.
- cosine threshold 0.5 may be too conservative for some domains. This is tunable via `minSimilarity` in `RetrieveOptions` and can be lowered per feature flag rollout.
- The `document_chunks` query uses a full-table scan with an IVFFlat index (created via `pgvector`) — at the scale of this project this is fine. An HNSW index or partitioned search may be needed beyond ~1M chunks per org.

**Follow-up work:**
- Surface citations in the streaming UI (send chunk IDs via data stream annotations)
- Add RLS policy for `ai_message_sources` if the table is exposed via the public API
- Lower cosine threshold and add re-ranking for multi-document retrieval
- Add a `ragEnabled` field to the AI session record so the client knows context was active
