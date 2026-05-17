import { PageAnalytics } from '@/components/page-analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireMembership } from '@/lib/orgs/guards';
import { and, db, desc, documents, eq, isNull } from '@ai-workspace-lab/db';
import type { Document } from '@ai-workspace-lab/db';
import { FileText, Plus } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface DocumentsPageProps {
  params: Promise<{ orgSlug: string }>;
}

function statusBadge(status: Document['status']) {
  const processingStatuses = ['queued', 'processing', 'chunking', 'embedding', 'indexed'];
  if (status === 'ready') return <Badge className="bg-green-100 text-green-800 border-green-200">Ready</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  if (processingStatuses.includes(status)) return <Badge>{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { orgSlug } = await params;
  const { organization } = await requireMembership(orgSlug);

  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.organizationId, organization.id), isNull(documents.deletedAt)))
    .orderBy(desc(documents.createdAt));

  return (
    <>
      <PageAnalytics event="documents_viewed" properties={{ org_slug: orgSlug }} />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="text-sm text-muted-foreground">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button asChild>
            <Link href={`/app/${orgSlug}/documents/new`}>
              <Plus className="size-4" />
              Upload
            </Link>
          </Button>
        </div>

        {docs.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No documents yet"
            description="Upload a PDF, plain text, or Markdown file to get started."
            action={
              <Button asChild>
                <Link href={`/app/${orgSlug}/documents/new`}>Upload your first document</Link>
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/app/${orgSlug}/documents/${doc.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground uppercase">{doc.fileType}</p>
                  </div>
                </div>
                <div className="ml-4 shrink-0">{statusBadge(doc.status)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
