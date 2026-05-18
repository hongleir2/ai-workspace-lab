import { createOpenAI } from '@ai-sdk/openai';
import { type Database, and, db, documents, eq, isNull, sql } from '@ai-workspace-lab/db';
import { embed } from 'ai';
import { AiError, EMBEDDING_MODEL } from './index';

export interface RagChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  sectionTitle: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  similarity: number;
}

export interface RetrieveOptions {
  topK?: number;
  documentId?: string;
  minSimilarity?: number;
}

export async function embedQuery(queryText: string, apiKey: string): Promise<number[]> {
  if (!apiKey) {
    throw new AiError('OPENAI_API_KEY is not configured', 'CONFIGURATION_ERROR');
  }
  const openaiClient = createOpenAI({ apiKey });
  const { embedding } = await embed({
    model: openaiClient.embedding(EMBEDDING_MODEL),
    value: queryText,
    maxRetries: 2,
  });
  return embedding;
}

export async function validateRagScope(
  orgId: string,
  documentId: string,
  dbConn: Database = db,
): Promise<void> {
  const [doc] = await dbConn
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, orgId),
        isNull(documents.deletedAt),
      ),
    )
    .limit(1);

  if (!doc) {
    throw new Error(`Document ${documentId} not found in organization ${orgId}`);
  }
}

export async function retrieveRelevantChunks(
  orgId: string,
  queryEmbedding: number[],
  opts: RetrieveOptions = {},
  dbConn: Database = db,
): Promise<RagChunk[]> {
  const { topK = 5, documentId, minSimilarity = 0.3 } = opts;

  if (queryEmbedding.some((v) => !Number.isFinite(v))) {
    throw new AiError('Query embedding contains non-finite values', 'PROVIDER_ERROR');
  }

  // Build vector literal for pgvector — safe: values are finite floats validated above
  const vectorLiteral = sql.raw(`'[${queryEmbedding.join(',')}]'::vector`);

  type Row = {
    id: string;
    document_id: string;
    chunk_index: number;
    text: string;
    section_title: string | null;
    page_start: number | null;
    page_end: number | null;
    similarity: number;
  };

  const docFilter = documentId ? sql`AND document_id = ${documentId}` : sql``;

  const rows = (await dbConn.execute(sql`
    SELECT
      id,
      document_id,
      chunk_index,
      text,
      section_title,
      page_start,
      page_end,
      (1 - (embedding <=> ${vectorLiteral})) AS similarity
    FROM document_chunks
    WHERE organization_id = ${orgId}
      AND embedding IS NOT NULL
      ${docFilter}
      AND (1 - (embedding <=> ${vectorLiteral})) >= ${minSimilarity}
    ORDER BY embedding <=> ${vectorLiteral}
    LIMIT ${topK}
  `)) as unknown as Row[];

  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    sectionTitle: row.section_title,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    similarity: row.similarity,
  }));
}

export function buildContextBlock(chunks: RagChunk[]): string {
  if (chunks.length === 0) return '';

  return chunks
    .map((chunk, i) => {
      const parts: string[] = [];
      if (chunk.sectionTitle) parts.push(`Section: ${chunk.sectionTitle}`);
      if (chunk.pageStart !== null) {
        parts.push(
          chunk.pageEnd !== null && chunk.pageEnd !== chunk.pageStart
            ? `Pages ${chunk.pageStart}–${chunk.pageEnd}`
            : `Page ${chunk.pageStart}`,
        );
      }
      const header = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      return `[${i + 1}]${header}\n${chunk.text}`;
    })
    .join('\n\n---\n\n');
}
