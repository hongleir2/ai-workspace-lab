import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnv, mockLimit, mockRatelimitCtor, mockSlidingWindow, mockRedisCtor } = vi.hoisted(
  () => {
    const mockLimit = vi.fn();
    const mockSlidingWindow = vi.fn();
    const mockRedisCtor = vi.fn();
    const mockRatelimitCtor = vi.fn((config: unknown) => ({
      config,
      limit: mockLimit,
    }));

    const mockEnv: {
      UPSTASH_REDIS_REST_URL: string | undefined;
      UPSTASH_REDIS_REST_TOKEN: string | undefined;
    } = {
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    };

    return {
      mockEnv,
      mockLimit,
      mockRatelimitCtor,
      mockSlidingWindow,
      mockRedisCtor,
    };
  },
);

vi.mock('@/lib/env', () => ({ env: mockEnv }));
vi.mock('@upstash/redis', () => ({ Redis: mockRedisCtor }));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(mockRatelimitCtor, {
    slidingWindow: mockSlidingWindow,
  }),
}));
import { checkAiRateLimit } from './rate-limit';

describe('checkAiRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    mockEnv.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('allows requests up to the free-plan limit', async () => {
    mockSlidingWindow.mockReturnValue({ kind: 'free-window' });
    mockLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      reset: 123,
    });

    await expect(checkAiRateLimit('user-1', 'org-1', 'free')).resolves.toEqual({
      allowed: true,
      remaining: 4,
      reset: 123,
    });

    expect(mockRedisCtor).toHaveBeenCalledOnce();
    expect(mockRedisCtor).toHaveBeenCalledWith({
      url: mockEnv.UPSTASH_REDIS_REST_URL,
      token: mockEnv.UPSTASH_REDIS_REST_TOKEN,
    });
    expect(mockRatelimitCtor).toHaveBeenCalledOnce();
    expect(mockRatelimitCtor).toHaveBeenCalledWith({
      redis: expect.anything(),
      limiter: { kind: 'free-window' },
      prefix: '@ai-workspace-lab/ai_chat',
    });
    expect(mockSlidingWindow).toHaveBeenCalledOnce();
    expect(mockSlidingWindow).toHaveBeenCalledWith(5, '1m');
    expect(mockLimit).toHaveBeenCalledWith('org:org-1:user:user-1');
  });

  it('blocks requests over the paid-plan limit', async () => {
    mockSlidingWindow.mockReturnValue({ kind: 'paid-window' });
    mockLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: 456,
    });

    await expect(checkAiRateLimit('user-2', 'org-2', 'pro')).resolves.toEqual({
      allowed: false,
      remaining: 0,
      reset: 456,
    });

    expect(mockSlidingWindow).toHaveBeenCalledWith(30, '1m');
    expect(mockLimit).toHaveBeenCalledWith('org:org-2:user:user-2');
  });

  it('allows all requests when Upstash env vars are missing', async () => {
    mockEnv.UPSTASH_REDIS_REST_URL = undefined;
    mockEnv.UPSTASH_REDIS_REST_TOKEN = undefined;

    await expect(checkAiRateLimit('user-3', 'org-3', 'free')).resolves.toEqual({
      allowed: true,
      remaining: 999,
      reset: 0,
    });

    expect(mockRedisCtor).not.toHaveBeenCalled();
    expect(mockRatelimitCtor).not.toHaveBeenCalled();
    expect(mockSlidingWindow).not.toHaveBeenCalled();
    expect(mockLimit).not.toHaveBeenCalled();
  });
});
