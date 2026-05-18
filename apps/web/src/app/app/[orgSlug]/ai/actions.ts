'use server';

import { requireMembership } from '@/lib/orgs/guards';
import { aiSessions, and, db, eq, isNull } from '@ai-workspace-lab/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateSessionTitle(
  orgSlug: string,
  sessionId: string,
  title: string,
): Promise<void> {
  const { organization, user } = await requireMembership(orgSlug);

  const trimmed = title.trim();
  if (!trimmed) return;

  await db
    .update(aiSessions)
    .set({ title: trimmed })
    .where(
      and(
        eq(aiSessions.id, sessionId),
        eq(aiSessions.organizationId, organization.id),
        eq(aiSessions.createdByUserId, user.id),
        isNull(aiSessions.deletedAt),
      ),
    );

  revalidatePath(`/app/${orgSlug}/ai`);
  revalidatePath(`/app/${orgSlug}/ai/sessions/${sessionId}`);
}

export async function deleteSession(orgSlug: string, sessionId: string): Promise<void> {
  const { organization, user } = await requireMembership(orgSlug);

  const [session] = await db
    .select({ id: aiSessions.id })
    .from(aiSessions)
    .where(
      and(
        eq(aiSessions.id, sessionId),
        eq(aiSessions.organizationId, organization.id),
        eq(aiSessions.createdByUserId, user.id),
        isNull(aiSessions.deletedAt),
      ),
    )
    .limit(1);

  if (!session) return;

  await db.update(aiSessions).set({ deletedAt: new Date() }).where(eq(aiSessions.id, sessionId));

  revalidatePath(`/app/${orgSlug}/ai`);
  redirect(`/app/${orgSlug}/ai`);
}

export async function createChatSession(orgSlug: string): Promise<void> {
  const { organization, user } = await requireMembership(orgSlug);

  const [session] = await db
    .insert(aiSessions)
    .values({
      organizationId: organization.id,
      createdByUserId: user.id,
      title: 'New Chat',
      visibility: 'private',
      status: 'active',
    })
    .returning({ id: aiSessions.id });

  if (!session) {
    throw new Error('Failed to create AI session');
  }

  revalidatePath(`/app/${orgSlug}/ai`);
  redirect(`/app/${orgSlug}/ai/sessions/${session.id}`);
}
