import { DocumentActionsMenu } from '@/app/app/[orgSlug]/documents/document-actions-menu';
import { PageAnalytics } from '@/components/page-analytics';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { FLAGS, getServerFeatureFlag } from '@/lib/analytics/flags';
import { requireMembership } from '@/lib/orgs/guards';
import { and, db, desc, documents, eq, isNull } from '@ai-workspace-lab/db';
import { FEATURE_KEYS, checkEntitlement } from '@ai-workspace-lab/entitlements';
import { FileText, MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface DocumentsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { orgSlug } = await params;
  const { user, organization } = await requireMembership(orgSlug);

  const [uploadEnabled, uploadEntitled] = await Promise.all([
    getServerFeatureFlag(FLAGS.DOCUMENT_UPLOAD, user.id),
    checkEntitlement(organization.id, FEATURE_KEYS.DOCUMENT_UPLOADS).catch(() => false),
  ]);
  if (!uploadEnabled) notFound();

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
          {uploadEntitled ? (
            <Button asChild>
              <Link href={`/app/${orgSlug}/documents/new`}>
                <Plus className="size-4" />
                Upload
              </Link>
            </Button>
          ) : (
            <Tooltip content="Not included in your current plan">
              <TooltipTrigger asChild>
                <span>
                  <Button disabled aria-disabled="true">
                    <Plus className="size-4" />
                    Upload
                  </Button>
                </span>
              </TooltipTrigger>
            </Tooltip>
          )}
        </div>

        {docs.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No documents yet"
            description={
              uploadEntitled
                ? 'Upload a PDF, plain text, or Markdown file to get started.'
                : 'Document uploads are not included in your current plan.'
            }
            action={
              uploadEntitled ? (
                <Button asChild>
                  <Link href={`/app/${orgSlug}/documents/new`}>Upload your first document</Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href={`/app/${orgSlug}/settings/billing`}>Upgrade plan</Link>
                </Button>
              )
            }
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <Link
                  href={`/app/${orgSlug}/documents/${doc.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground uppercase">{doc.fileType}</p>
                  </div>
                </Link>
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  {doc.status === 'ready' ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/app/${orgSlug}/documents/${doc.id}/ask`}>
                        <MessageSquare className="size-3.5" />
                        Ask AI
                      </Link>
                    </Button>
                  ) : null}
                  <DocumentActionsMenu
                    orgSlug={orgSlug}
                    documentId={doc.id}
                    documentTitle={doc.title}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
