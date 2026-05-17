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
import { downloadObject } from '@ai-workspace-lab/storage';

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
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        current = '';
        for (const sentence of sentences) {
          if (current.length + sentence.length + 1 <= MAX_CHARS_PER_CHUNK) {
            current = current ? `${current} ${sentence}` : sentence;
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
      return result.text;
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

  const [doc] = await dbConn
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .limit(1);

  if (!doc) {
    throw new Error(`Document not found or deleted: ${documentId}`);
  }

  const [storageObj] = await dbConn
    .select()
    .from(storageObjects)
    .where(and(eq(storageObjects.id, doc.storageObjectId), isNull(storageObjects.deletedAt)))
    .limit(1);

  if (!storageObj) {
    throw new Error(`Storage object not found: ${doc.storageObjectId}`);
  }

  await dbConn.update(documents).set({ status: 'processing' }).where(eq(documents.id, documentId));

  try {
    const buffer = await downloadObject(storageObj.objectKey);
    const text = await extractText(buffer, doc.fileType);
    const textChunks = chunkText(text);

    // Delete existing chunks for idempotency (safe to retry)
    await dbConn.delete(documentChunks).where(eq(documentChunks.documentId, documentId));

    if (textChunks.length > 0) {
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
  } catch (err) {
    await dbConn
      .update(documents)
      .set({
        status: 'failed',
        processingErrorCode: 'EXTRACTION_FAILED',
        processingErrorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(documents.id, documentId));
    throw err;
  }
}
