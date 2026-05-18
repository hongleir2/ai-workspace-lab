'use server';

import { requireMembership } from '@/lib/orgs/guards';
import { and, db, documents, eq, isNull } from '@ai-workspace-lab/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function renameDocument(
  orgSlug: string,
  documentId: string,
  title: string,
): Promise<void> {
  const { organization } = await requireMembership(orgSlug);
  const trimmed = title.trim();
  if (!trimmed) return;

  await db
    .update(documents)
    .set({ title: trimmed })
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organization.id),
        isNull(documents.deletedAt),
      ),
    );

  revalidatePath(`/app/${orgSlug}/documents`);
  revalidatePath(`/app/${orgSlug}/documents/${documentId}`);
}

export async function deleteDocument(orgSlug: string, documentId: string): Promise<void> {
  const { organization } = await requireMembership(orgSlug);

  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organization.id),
        isNull(documents.deletedAt),
      ),
    )
    .limit(1);

  if (!doc) return;

  await db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, documentId));

  revalidatePath(`/app/${orgSlug}/documents`);
  redirect(`/app/${orgSlug}/documents`);
}
