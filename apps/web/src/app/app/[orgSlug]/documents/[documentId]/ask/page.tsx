import { requireMembership } from '@/lib/orgs/guards';
import { aiSessions, and, db, documents, eq, isNull } from '@ai-workspace-lab/db';
import { notFound, redirect } from 'next/navigation';

interface AskDocumentPageProps {
  params: Promise<{ orgSlug: string; documentId: string }>;
}

export default async function AskDocumentPage({ params }: AskDocumentPageProps) {
  const { orgSlug, documentId } = await params;
  const { organization, user } = await requireMembership(orgSlug);

  const [doc] = await db
    .select({ id: documents.id, title: documents.title, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organization.id),
        isNull(documents.deletedAt),
      ),
    )
    .limit(1);

  if (!doc) notFound();

  if (doc.status !== 'ready') {
    redirect(`/app/${orgSlug}/documents/${documentId}`);
  }

  const [session] = await db
    .insert(aiSessions)
    .values({
      organizationId: organization.id,
      createdByUserId: user.id,
      documentId,
      title: `Ask: ${doc.title}`,
      visibility: 'private',
      status: 'active',
    })
    .returning({ id: aiSessions.id });

  if (!session) throw new Error('Failed to create AI session');

  redirect(`/app/${orgSlug}/ai/sessions/${session.id}`);
}
