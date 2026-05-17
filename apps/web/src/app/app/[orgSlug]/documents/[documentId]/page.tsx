import { PageAnalytics } from '@/components/page-analytics';
import { Badge } from '@/components/ui/badge';
import { requireMembership } from '@/lib/orgs/guards';
import { and, db, documents, eq, isNull, storageObjects } from '@ai-workspace-lab/db';
import type { Document } from '@ai-workspace-lab/db';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface DocumentDetailPageProps {
  params: Promise<{ orgSlug: string; documentId: string }>;
}

function statusBadge(status: Document['status']) {
  const processingStatuses: Document['status'][] = [
    'uploaded',
    'queued',
    'processing',
    'chunking',
    'embedding',
    'indexed',
  ];
  if (status === 'ready')
    return <Badge className="bg-green-100 text-green-800 border-green-200">Ready</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  if (processingStatuses.includes(status)) return <Badge>{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { orgSlug, documentId } = await params;
  const { organization } = await requireMembership(orgSlug);

  const rows = await db
    .select({ document: documents, storageObject: storageObjects })
    .from(documents)
    .innerJoin(storageObjects, eq(documents.storageObjectId, storageObjects.id))
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organization.id),
        isNull(documents.deletedAt),
        isNull(storageObjects.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

  const { document, storageObject } = row;
  const uploadedAt = document.createdAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <PageAnalytics
        event="document_detail_viewed"
        properties={{ org_slug: orgSlug, document_id: document.id, file_type: document.fileType }}
      />
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <Link
            href={`/app/${orgSlug}/documents`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Documents
          </Link>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight truncate">{document.title}</h1>
            </div>
            {statusBadge(document.status)}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              File type
            </dt>
            <dd className="font-medium uppercase">{document.fileType}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Size
            </dt>
            <dd className="font-medium">{formatBytes(storageObject.byteSize)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Uploaded
            </dt>
            <dd className="font-medium">{uploadedAt}</dd>
          </div>
          {document.processingErrorMessage ? (
            <div className="col-span-full flex flex-col gap-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-destructive">
                Error
              </dt>
              <dd className="text-destructive">{document.processingErrorMessage}</dd>
            </div>
          ) : null}
        </dl>

        {document.status !== 'ready' && document.status !== 'failed' ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              <div className="size-2 animate-pulse rounded-full bg-blue-500" />
              <div>
                <p className="text-sm font-medium">Processing</p>
                <p className="text-xs text-muted-foreground">
                  {document.status === 'queued'
                    ? 'Queued for processing — will start shortly.'
                    : 'Extracting and indexing content — check back in a moment.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
