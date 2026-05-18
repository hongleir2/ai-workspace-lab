import { PageAnalytics } from '@/components/page-analytics';
import { logger } from '@/lib/axiom/server';
import { requireMembership } from '@/lib/orgs/guards';
import { aiMessages, aiSessions, and, asc, db, documents, eq, isNull } from '@ai-workspace-lab/db';
import { FEATURE_KEYS } from '@ai-workspace-lab/entitlements';
import {
  getCurrentBillingPeriod,
  getOrganizationPlan,
  getPlanLimits,
  getUsedQuantityInPeriod,
} from '@ai-workspace-lab/entitlements';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type AiChatMessage, type AiChatQuota, ChatInterface } from './chat-interface';
import { SessionTitleEditor } from './session-title-editor';

export const dynamic = 'force-dynamic';

interface AiSessionPageProps {
  params: Promise<{ orgSlug: string; sessionId: string }>;
}

function resetSummary(interval: string): string {
  switch (interval) {
    case 'day':
      return 'Resets daily';
    case 'month':
      return 'Resets monthly';
    case 'billing_period':
      return 'Resets each billing period';
    case 'none':
      return 'Static limit';
    default:
      return 'Usage limit';
  }
}

async function loadAiChatQuota(orgId: string): Promise<AiChatQuota | null> {
  try {
    const { subscription, plan } = await getOrganizationPlan(orgId);
    const limits = await getPlanLimits(plan.id, FEATURE_KEYS.AI_MESSAGES);
    const limit = limits[0];

    if (!limit) {
      return {
        limit: null,
        used: null,
        unlimited: true,
        exceeded: false,
        resetSummary: null,
      };
    }

    if (limit.limitValue === null) {
      return {
        limit: null,
        used: null,
        unlimited: true,
        exceeded: false,
        resetSummary: resetSummary(limit.resetInterval),
      };
    }

    const period =
      limit.resetInterval === 'none'
        ? null
        : getCurrentBillingPeriod(subscription, limit.resetInterval);
    const used = period
      ? await getUsedQuantityInPeriod(orgId, FEATURE_KEYS.AI_MESSAGES, period)
      : null;

    return {
      limit: limit.limitValue,
      used,
      unlimited: false,
      exceeded: used !== null ? used >= limit.limitValue : false,
      resetSummary: resetSummary(limit.resetInterval),
    };
  } catch (error: unknown) {
    logger.warn('ai_session.quota_load_failed', {
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export default async function AiSessionPage({ params }: AiSessionPageProps) {
  const { orgSlug, sessionId } = await params;
  const { user, organization } = await requireMembership(orgSlug);

  const sessionRows = await db
    .select({
      session: aiSessions,
      documentTitle: documents.title,
    })
    .from(aiSessions)
    .leftJoin(documents, eq(aiSessions.documentId, documents.id))
    .where(
      and(
        eq(aiSessions.id, sessionId),
        eq(aiSessions.organizationId, organization.id),
        eq(aiSessions.createdByUserId, user.id),
        eq(aiSessions.status, 'active'),
        isNull(aiSessions.deletedAt),
      ),
    )
    .limit(1);

  const row = sessionRows[0];
  if (!row) {
    notFound();
  }
  const session = row.session;
  const documentId = session.documentId ?? undefined;
  const documentName = row.documentTitle ?? undefined;

  const [messageRows, quota] = await Promise.all([
    db
      .select()
      .from(aiMessages)
      .where(
        and(eq(aiMessages.organizationId, organization.id), eq(aiMessages.sessionId, sessionId)),
      )
      .orderBy(asc(aiMessages.createdAt)),
    loadAiChatQuota(organization.id),
  ]);

  const initialMessages: AiChatMessage[] = messageRows
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      id: message.id,
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

  return (
    <>
      <PageAnalytics
        event="ai_session_viewed"
        properties={{ org_slug: orgSlug, session_id: sessionId }}
      />
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={`/app/${orgSlug}/ai`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              AI chats
            </Link>
            <SessionTitleEditor
              orgSlug={orgSlug}
              sessionId={sessionId}
              initialTitle={session.title ?? 'New Chat'}
            />
          </div>
        </div>

        <ChatInterface
          orgSlug={orgSlug}
          sessionId={sessionId}
          initialMessages={initialMessages}
          quota={quota}
          {...(documentId ? { documentId } : {})}
          {...(documentName ? { documentName } : {})}
        />
      </div>
    </>
  );
}
