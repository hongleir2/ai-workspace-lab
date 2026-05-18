'use server';

import { requireMembership } from '@/lib/orgs/guards';
import { aiSessions, db } from '@ai-workspace-lab/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
