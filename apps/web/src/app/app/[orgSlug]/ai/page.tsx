import { PageAnalytics } from '@/components/page-analytics';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireMembership } from '@/lib/orgs/guards';
import { aiSessions, and, db, desc, eq, isNull } from '@ai-workspace-lab/db';
import { MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { createChatSession } from './actions';

export const dynamic = 'force-dynamic';

interface AiHomePageProps {
  params: Promise<{ orgSlug: string }>;
}

function formatSessionTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default async function AiHomePage({ params }: AiHomePageProps) {
  const { orgSlug } = await params;
  const { user, organization } = await requireMembership(orgSlug);

  const sessions = await db
    .select()
    .from(aiSessions)
    .where(
      and(
        eq(aiSessions.organizationId, organization.id),
        eq(aiSessions.createdByUserId, user.id),
        eq(aiSessions.status, 'active'),
        isNull(aiSessions.deletedAt),
      ),
    )
    .orderBy(desc(aiSessions.updatedAt))
    .limit(50);

  return (
    <>
      <PageAnalytics event="ai_home_viewed" properties={{ org_slug: orgSlug }} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">AI chats</h1>
            <p className="text-sm text-muted-foreground">
              {sessions.length} chat{sessions.length === 1 ? '' : 's'}
            </p>
          </div>

          <form action={createChatSession.bind(null, orgSlug)}>
            <Button type="submit">
              <Plus className="size-4" />
              New Chat
            </Button>
          </form>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-5" />}
            title="No chats yet"
            description="Start a new chat to ask questions in this workspace."
            action={
              <form action={createChatSession.bind(null, orgSlug)}>
                <Button type="submit">Start your first chat</Button>
              </form>
            }
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/app/${orgSlug}/ai/sessions/${session.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{session.title ?? 'New Chat'}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatSessionTimestamp(session.updatedAt)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">Open</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
