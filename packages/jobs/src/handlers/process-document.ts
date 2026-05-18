import {
  type Database,
  and,
  db,
  documentChunks,
  documents,
  eq,
  isNull,
  storageObjects,
} from '@ai-workspace-lab/db';
import { createLogger } from '@ai-workspace-lab/logger';
import { downloadObject } from '@ai-workspace-lab/storage';
import { encodingForModel } from 'js-tiktoken';

const logger = createLogger('jobs/process-document');

export interface ProcessDocumentPayload {
  documentId: string;
}

export const CHUNKING_STRATEGY = 'paragraph_sentence_token_v1';

export const DEFAULT_CHUNK_OPTIONS = {
  maxTokens: 700,
  overlapTokens: 100,
};

type ChunkOptions = {
  maxTokens: number;
  overlapTokens: number;
};

export type TokenChunk = {
  text: string;
  tokenCount: number;
  chunkIndex: number;
  startCharIndex: number;
  endCharIndex: number;
};

type PdfParser = (buffer: Buffer, options?: { max?: number }) => Promise<{ text: string }>;
// Start loading pdf-parse at module initialisation so the 60s Vercel function
// clock doesn't tick during pdf.js cold-start on the first call.
const pdfParseReady: Promise<PdfParser> = import('pdf-parse').then(
  (m) => (m as { default: PdfParser }).default,
);

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。？！；…])\s*/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function chunkTextByTokens(
  text: string,
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): TokenChunk[] {
  const encoder = encodingForModel('text-embedding-3-small');

  // Build a flat ordered list of sentences with their char positions in `text`.
  type SentenceInfo = { text: string; charStart: number; charEnd: number };
  const allSentences: SentenceInfo[] = [];

  let searchFrom = 0;
  for (const para of text.split(/\n\n+/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const paraStart = text.indexOf(trimmed, searchFrom);
    let sentSearchFrom = paraStart >= 0 ? paraStart : searchFrom;

    for (const sentence of splitSentences(trimmed)) {
      const sentStart = text.indexOf(sentence, sentSearchFrom);
      const start = sentStart >= 0 ? sentStart : sentSearchFrom;
      allSentences.push({ text: sentence, charStart: start, charEnd: start + sentence.length });
      sentSearchFrom = start + sentence.length;
    }

    searchFrom = paraStart >= 0 ? paraStart + trimmed.length : searchFrom + para.length;
  }

  const chunks: TokenChunk[] = [];
  // Sentences accumulated into the current chunk (new content, after overlap seed).
  let currentSentences: SentenceInfo[] = [];
  let currentTokens = 0;
  // Overlap text prepended to the next chunk's content.
  let overlapText = '';
  let overlapTokens = 0;

  const flush = () => {
    if (currentSentences.length === 0) return;

    const newContent = currentSentences.map((s) => s.text).join('\n');
    const fullText = overlapText ? `${overlapText}\n${newContent}`.trim() : newContent.trim();
    if (!fullText) return;

    const fullTokenArr = encoder.encode(fullText);
    chunks.push({
      text: fullText,
      tokenCount: fullTokenArr.length,
      chunkIndex: chunks.length,
      startCharIndex: currentSentences[0]?.charStart ?? 0,
      endCharIndex: currentSentences[currentSentences.length - 1]?.charEnd ?? 0,
    });

    // Seed next chunk with the tail of this chunk's tokens as overlap.
    const tailTokens = fullTokenArr.slice(Math.max(0, fullTokenArr.length - options.overlapTokens));
    overlapText = encoder.decode(tailTokens).trim();
    overlapTokens = tailTokens.length;
    currentSentences = [];
    currentTokens = 0;
  };

  for (const sentence of allSentences) {
    const sentTokens = encoder.encode(sentence.text).length;

    if (sentTokens > options.maxTokens) {
      // Single sentence is larger than the budget — flush current and hard-split it.
      flush();

      const tokens = encoder.encode(sentence.text);
      const step = options.maxTokens - options.overlapTokens;

      for (let i = 0; i < tokens.length; i += step) {
        const slice = tokens.slice(i, i + options.maxTokens);
        const sliceText = encoder.decode(slice).trim();
        if (sliceText) {
          chunks.push({
            text: sliceText,
            tokenCount: slice.length,
            chunkIndex: chunks.length,
            startCharIndex: sentence.charStart,
            endCharIndex: sentence.charEnd,
          });
        }
      }

      // Overlap from the last hard-split chunk.
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk) {
        const lastTokens = encoder.encode(lastChunk.text);
        const tailTokens = lastTokens.slice(Math.max(0, lastTokens.length - options.overlapTokens));
        overlapText = encoder.decode(tailTokens).trim();
        overlapTokens = tailTokens.length;
      }
      currentSentences = [];
      currentTokens = 0;
      continue;
    }

    // Would adding this sentence exceed the budget?
    const projectedTokens = overlapTokens + currentTokens + sentTokens;
    if (projectedTokens > options.maxTokens && currentSentences.length > 0) {
      flush();
    }

    currentSentences.push(sentence);
    currentTokens += sentTokens;
  }

  flush();
  return chunks;
}

export async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  switch (fileType) {
    case 'txt':
    case 'md':
      return buffer.toString('utf-8');
    case 'pdf': {
      const pdfParse = await pdfParseReady;
      const result = await pdfParse(buffer, { max: 10 });
      // pdf-parse emits U+0000 for ligatures (fi, fl, ff) it can't decode from
      // the font encoding. Postgres text rejects null bytes — strip them.
      // split/join avoids lint rules against control chars in regex literals.
      // All valid Unicode (CJK, accented characters) is preserved.
      const cleaned = result.text.split(String.fromCharCode(0)).join('');
      return cleaned.normalize('NFC');
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

export async function processDocumentHandler(
  payload: ProcessDocumentPayload,
  dbConn: Database = db,
): Promise<void> {
  const { documentId } = payload;
  const startMs = Date.now();

  logger.debug('document.fetch.start', { documentId });

  const [doc] = await dbConn
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .limit(1);

  if (!doc) {
    logger.error('document.not_found', { documentId });
    throw new Error(`Document not found or deleted: ${documentId}`);
  }

  logger.debug('document.fetch.done', {
    documentId,
    orgId: doc.organizationId,
    fileType: doc.fileType,
    storageObjectId: doc.storageObjectId,
    status: doc.status,
  });

  logger.debug('storage_object.fetch.start', {
    documentId,
    storageObjectId: doc.storageObjectId,
  });

  const [storageObj] = await dbConn
    .select()
    .from(storageObjects)
    .where(and(eq(storageObjects.id, doc.storageObjectId), isNull(storageObjects.deletedAt)))
    .limit(1);

  if (!storageObj) {
    logger.error('storage_object.not_found', {
      documentId,
      storageObjectId: doc.storageObjectId,
    });
    throw new Error(`Storage object not found: ${doc.storageObjectId}`);
  }

  logger.debug('storage_object.fetch.done', {
    documentId,
    objectKey: storageObj.objectKey,
    contentType: storageObj.contentType,
    byteSize: storageObj.byteSize,
  });

  logger.info('document.processing.started', {
    documentId,
    orgId: doc.organizationId,
    fileType: doc.fileType,
  });

  await dbConn.update(documents).set({ status: 'processing' }).where(eq(documents.id, documentId));

  try {
    logger.debug('document.download.start', {
      documentId,
      objectKey: storageObj.objectKey,
    });

    const buffer = await downloadObject(storageObj.objectKey);

    logger.debug('document.download.done', {
      documentId,
      bufferSize: buffer.length,
    });

    logger.debug('document.extract.start', {
      documentId,
      fileType: doc.fileType,
    });

    const text = await extractText(buffer, doc.fileType);

    logger.debug('document.extract.done', {
      documentId,
      textLength: text.length,
    });

    const tokenChunks = chunkTextByTokens(text);

    logger.info('document.text_extracted', {
      documentId,
      textLength: text.length,
      chunksCount: tokenChunks.length,
      chunkingStrategy: CHUNKING_STRATEGY,
    });

    // Delete existing chunks for idempotency (safe to retry)
    await dbConn.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
    logger.debug('document.chunks.deleted', { documentId });

    if (tokenChunks.length > 0) {
      logger.debug('document.chunks.inserting', {
        documentId,
        chunksCount: tokenChunks.length,
      });

      await dbConn.insert(documentChunks).values(
        tokenChunks.map((chunk) => ({
          organizationId: doc.organizationId,
          documentId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          tokenCount: chunk.tokenCount,
          chunkingStrategy: CHUNKING_STRATEGY,
          startCharIndex: chunk.startCharIndex,
          endCharIndex: chunk.endCharIndex,
        })),
      );
    }

    await dbConn
      .update(documents)
      .set({ status: 'ready', readyAt: new Date() })
      .where(eq(documents.id, documentId));

    const durationMs = Date.now() - startMs;
    logger.info('document.processing.completed', {
      documentId,
      orgId: doc.organizationId,
      chunksCreated: tokenChunks.length,
      durationMs,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('document.processing.failed', {
      documentId,
      orgId: doc.organizationId,
      errorCode: 'EXTRACTION_FAILED',
      error: errorMessage,
    });

    await dbConn
      .update(documents)
      .set({
        status: 'failed',
        processingErrorCode: 'EXTRACTION_FAILED',
        processingErrorMessage: errorMessage,
      })
      .where(eq(documents.id, documentId));
    throw err;
  }
}
