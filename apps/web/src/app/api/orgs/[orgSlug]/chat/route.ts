import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import { FLAGS, getServerFeatureFlag } from '@/lib/analytics/flags';
import { getCurrentUser } from '@/lib/auth/user';
import { logger } from '@/lib/axiom/server';
import { env } from '@/lib/env';
import { getOrganizationBySlug } from '@/lib/orgs/service';
import {
  AiError,
  buildPromptFromMessages,
  estimateCost,
  normalizeTokenUsage,
  streamChatCompletion,
} from '@ai-workspace-lab/ai';
import type { AiCompletionOptions } from '@ai-workspace-lab/ai';
import {
  aiMessages,
  aiSessions,
  and,
  db,
  eq,
  isNull,
  organizationMemberships,
} from '@ai-workspace-lab/db';
import {
  EntitlementError,
  FEATURE_KEYS,
  assertFeatureAllowed,
  getCurrentBillingPeriod,
  getOrganizationPlan,
  getPlanLimits,
} from '@ai-workspace-lab/entitlements';
import { recordUsageWithCounter } from '@ai-workspace-lab/usage';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  sessionId: string;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record['role'] === 'user' || record['role'] === 'assistant') &&
    typeof record['content'] === 'string'
  );
}

const MAX_MESSAGES_PER_REQUEST = 100;

function isValidBody(body: unknown): body is RequestBody {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as Record<string, unknown>;
  return (
    Array.isArray(record['messages']) &&
    record['messages'].length > 0 &&
    record['messages'].length <= MAX_MESSAGES_PER_REQUEST &&
    record['messages'].every(isChatMessage) &&
    typeof record['sessionId'] === 'string' &&
    record['sessionId'].length > 0
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
): Promise<Response> {
  const traceId = (await headers()).get('x-trace-id') ?? undefined;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Missing required fields: messages (non-empty array), sessionId' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.status !== 'active') {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const [membership] = await db
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, user.id),
        eq(organizationMemberships.organizationId, org.id),
        eq(organizationMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (env.NEXT_PUBLIC_POSTHOG_KEY) {
    const flagEnabled = await getServerFeatureFlag(FLAGS.AI_CHAT, user.id);
    if (!flagEnabled) {
      return NextResponse.json(
        { error: 'AI chat is not enabled for your account' },
        { status: 403 },
      );
    }
  }

  try {
    await assertFeatureAllowed(org.id, FEATURE_KEYS.AI_MESSAGES);
  } catch (error) {
    if (error instanceof EntitlementError) {
      if (error.code === 'QUOTA_EXCEEDED') {
        logger.warn('ai.quota_exceeded', { traceId, orgId: org.id, userId: user.id });
        return NextResponse.json({ error: 'Monthly AI message quota exceeded' }, { status: 429 });
      }
      return NextResponse.json({ error: 'AI chat is not included in your plan' }, { status: 402 });
    }
    throw error;
  }

  const { subscription, plan } = await getOrganizationPlan(org.id);

  const rateLimit = await checkAiRateLimit(user.id, org.id, plan.id);
  if (!rateLimit.allowed) {
    logger.warn('ai.rate_limited', { traceId, orgId: org.id, userId: user.id });
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before sending another message.' },
      { status: 429 },
    );
  }

  const [session] = await db
    .select({ id: aiSessions.id })
    .from(aiSessions)
    .where(
      and(
        eq(aiSessions.id, body.sessionId),
        eq(aiSessions.organizationId, org.id),
        eq(aiSessions.createdByUserId, user.id),
        eq(aiSessions.status, 'active'),
        isNull(aiSessions.deletedAt),
      ),
    )
    .limit(1);

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const lastMessage = body.messages[body.messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    return NextResponse.json({ error: 'Last message must be from the user' }, { status: 400 });
  }

  const [userMessageRow] = await db
    .insert(aiMessages)
    .values({
      organizationId: org.id,
      sessionId: body.sessionId,
      createdByUserId: user.id,
      role: 'user',
      content: lastMessage.content,
      status: 'completed',
    })
    .returning();

  if (!userMessageRow) throw new Error('Failed to create chat user message');

  const planLimits = await getPlanLimits(plan.id, FEATURE_KEYS.AI_MESSAGES);
  const planLimit = planLimits[0];
  const period =
    planLimit?.resetInterval && planLimit.resetInterval !== 'none'
      ? getCurrentBillingPeriod(subscription, planLimit.resetInterval)
      : null;

  const modelName = env.OPENAI_MODEL ?? 'gpt-4o-mini';

  logger.info('ai.chat.started', {
    traceId,
    orgId: org.id,
    userId: user.id,
    sessionId: body.sessionId,
    model: modelName,
    messageCount: body.messages.length,
  });

  try {
    const streamInput: AiCompletionOptions = {
      apiKey: env.OPENAI_API_KEY ?? '',
      model: modelName,
      messages: buildPromptFromMessages(body.messages),
      onFinish: async ({ text, usage }) => {
        try {
          const normalized = normalizeTokenUsage(usage);
          const cost = estimateCost(modelName, normalized.inputTokens, normalized.outputTokens);

          await db
            .insert(aiMessages)
            .values({
              organizationId: org.id,
              sessionId: body.sessionId,
              role: 'assistant',
              content: text,
              status: 'completed',
              modelProvider: 'openai',
              modelName,
              inputTokens: normalized.inputTokens,
              outputTokens: normalized.outputTokens,
              totalTokens: normalized.totalTokens,
              costMicroUsd: cost,
              completedAt: new Date(),
            })
            .returning();

          if (period) {
            const usageArgs = {
              event: {
                organizationId: org.id,
                userId: user.id,
                featureKey: FEATURE_KEYS.AI_MESSAGES,
                eventType: 'ai_message',
                quantity: '1',
                unit: 'count' as const,
                provider: 'openai',
                modelName,
                inputTokens: normalized.inputTokens,
                outputTokens: normalized.outputTokens,
                totalTokens: normalized.totalTokens,
                costMicroUsd: cost,
                sourceType: 'ai_message',
                sourceId: userMessageRow.id,
                idempotencyKey: userMessageRow.id,
              },
              period,
              ...(planLimit?.limitValue !== null && planLimit?.limitValue !== undefined
                ? { limitQuantity: planLimit.limitValue.toString() }
                : {}),
            };
            await recordUsageWithCounter(usageArgs);
          }

          logger.info('ai.chat.completed', {
            traceId,
            orgId: org.id,
            userId: user.id,
            sessionId: body.sessionId,
            inputTokens: normalized.inputTokens,
            outputTokens: normalized.outputTokens,
            costMicroUsd: cost,
          });
        } catch (finishError) {
          logger.error('ai.chat.finish_error', {
            traceId,
            orgId: org.id,
            sessionId: body.sessionId,
            userMessageId: userMessageRow.id,
            error: finishError instanceof Error ? finishError.message : String(finishError),
          });
        }
      },
      ...(env.OPENAI_MAX_TOKENS !== undefined ? { maxTokens: env.OPENAI_MAX_TOKENS } : {}),
    };

    const result = streamChatCompletion(streamInput);

    return result.toDataStreamResponse();
  } catch (error) {
    if (error instanceof AiError && error.code === 'CONFIGURATION_ERROR') {
      logger.error('ai.configuration_error', { traceId, orgId: org.id, error: error.message });
      return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
    }
    logger.error('ai.chat.failed', {
      traceId,
      orgId: org.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
