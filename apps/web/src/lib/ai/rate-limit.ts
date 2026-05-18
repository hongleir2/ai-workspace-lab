import { env } from '@/lib/env';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

type UpstashRedisClient = Record<string, never>;

type UpstashRedisModule = {
  Redis: new (config: { url: string; token: string }) => UpstashRedisClient;
};

type UpstashRatelimitResponse = {
  success: boolean;
  remaining: number;
  reset: number;
};

type UpstashRatelimitInstance = {
  limit(identifier: string): Promise<UpstashRatelimitResponse>;
};

type UpstashRatelimitConstructor = {
  new (config: {
    redis: UpstashRedisClient;
    limiter: unknown;
    prefix: string;
  }): UpstashRatelimitInstance;
  slidingWindow(requests: number, duration: string): unknown;
};

type UpstashRatelimitModule = {
  Ratelimit: UpstashRatelimitConstructor;
};

const UPSTASH_REDIS_MODULE: string = '@upstash/redis';
const UPSTASH_RATELIMIT_MODULE: string = '@upstash/ratelimit';
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

  const [redisModule, ratelimitModule] = await Promise.all([
    import(UPSTASH_REDIS_MODULE),
    import(UPSTASH_RATELIMIT_MODULE),
  ]);

  const { Redis } = redisModule as unknown as UpstashRedisModule;
  const { Ratelimit } = ratelimitModule as unknown as UpstashRatelimitModule;
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
