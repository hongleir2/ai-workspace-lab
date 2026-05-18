import { env } from '@/lib/env';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

const AI_CHAT_PREFIX = '@ai-workspace-lab/ai_chat';
const FREE_PLAN_REQUESTS_PER_MINUTE = 5;
const NON_FREE_PLAN_REQUESTS_PER_MINUTE = 30;

function allowAll(): RateLimitResult {
  return { allowed: true, remaining: 999, reset: 0 };
}

export async function checkAiRateLimit(
  userId: string,
  orgId: string,
  planId: string,
): Promise<RateLimitResult> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return allowAll();
  }

  const requestsPerMinute =
    planId === 'free' ? FREE_PLAN_REQUESTS_PER_MINUTE : NON_FREE_PLAN_REQUESTS_PER_MINUTE;

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  const rateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requestsPerMinute, '1m'),
    prefix: AI_CHAT_PREFIX,
  });

  const result = await rateLimit.limit(`org:${orgId}:user:${userId}`);

  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
