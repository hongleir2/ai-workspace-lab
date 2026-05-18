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

const logger = createLogger('jobs/process-document');

export interface ProcessDocumentPayload {
  documentId: string;
}

const MAX_CHARS_PER_CHUNK = 1500;

type PdfParser = (buffer: Buffer, options?: { max?: number }) => Promise<{ text: string }>;
// Start loading pdf-parse at module initialisation so the 60s Vercel function
// clock doesn't tick during pdf.js cold-start on the first call.
const pdfParseReady: Promise<PdfParser> = import('pdf-parse').then(
  (m) => (m as { default: PdfParser }).default,
);

// Returns true when a space should be inserted between two adjacent sentences.
// CJK scripts don't use spaces as word separators, so we omit the space when
// the last character of `a` or first character of `b` is a CJK code point.
function needsSpace(a: string, b: string): boolean {
  if (!a || !b) return false;
  const cjk = /\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}|\p{Script=Katakana}/u;
  return !cjk.test(a[a.length - 1] ?? '') && !cjk.test(b[0] ?? '');
}

export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 <= MAX_CHARS_PER_CHUNK) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length > MAX_CHARS_PER_CHUNK) {
        // Sentence splitter covers Latin (.!?) and CJK (。？！；…) terminators.
        // \s* (not \s+) handles CJK prose where no space follows the terminator.
        const sentences = trimmed.split(/(?<=[.!?。？！；…])\s*/u);
        current = '';
        for (const sentence of sentences) {
          const sep = needsSpace(current, sentence) ? ' ' : '';
          if (current.length + sentence.length + sep.length <= MAX_CHARS_PER_CHUNK) {
            current = current ? `${current}${sep}${sentence}` : sentence;
          } else {
            if (current) chunks.push(current);
            // Sentence itself may exceed MAX_CHARS — emit fixed-width sub-chunks
            // so no content is silently dropped.
            let pos = 0;
            while (pos < sentence.length) {
              const sub = sentence.slice(pos, pos + MAX_CHARS_PER_CHUNK);
              current = sub;
              pos += sub.length;
              if (pos < sentence.length) {
                chunks.push(current);
                current = '';
              }
            }
          }
        }
      } else {
        current = trimmed;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
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

    const textChunks = chunkText(text);

    logger.info('document.text_extracted', {
      documentId,
      textLength: text.length,
      chunksCount: textChunks.length,
    });

    logger.debug('document.chunks.deleted', { documentId });

    // Delete existing chunks for idempotency (safe to retry)
    await dbConn.delete(documentChunks).where(eq(documentChunks.documentId, documentId));

    if (textChunks.length > 0) {
      logger.debug('document.chunks.inserted', {
        documentId,
        chunksCount: textChunks.length,
      });

      await dbConn.insert(documentChunks).values(
        textChunks.map((chunkContent, index) => ({
          organizationId: doc.organizationId,
          documentId,
          chunkIndex: index,
          text: chunkContent,
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
      chunksCreated: textChunks.length,
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
