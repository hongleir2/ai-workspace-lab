import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetFeatureFlag, mockShutdown, MockPostHog, mockEnv } = vi.hoisted(() => {
  const mockGetFeatureFlag = vi.fn();
  const mockShutdown = vi.fn().mockResolvedValue(undefined);
  const MockPostHog = vi.fn(() => ({
    getFeatureFlag: mockGetFeatureFlag,
    shutdown: mockShutdown,
  }));
  const mockEnv = {
    POSTHOG_PERSONAL_API_KEY: 'phx_test_key' as string | undefined,
    NEXT_PUBLIC_POSTHOG_KEY: 'phc_test_key' as string | undefined,
    NEXT_PUBLIC_POSTHOG_HOST: undefined as string | undefined,
  };
  return { mockGetFeatureFlag, mockShutdown, MockPostHog, mockEnv };
});

vi.mock('posthog-node', () => ({ PostHog: MockPostHog }));
vi.mock('@/lib/env', () => ({ env: mockEnv }));

import { getServerFeatureFlag } from './flags';

describe('getServerFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.POSTHOG_PERSONAL_API_KEY = 'phx_test_key';
    mockEnv.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
  });

  it('returns true when PostHog returns true', async () => {
    mockGetFeatureFlag.mockResolvedValue(true);
    expect(await getServerFeatureFlag('document_upload_enabled', 'user-1')).toBe(true);
  });

  it('returns false (default) when PostHog returns undefined', async () => {
    mockGetFeatureFlag.mockResolvedValue(undefined);
    expect(await getServerFeatureFlag('ai_chat_enabled', 'user-1')).toBe(false);
  });

  it('returns false (default) when PostHog throws', async () => {
    mockGetFeatureFlag.mockRejectedValue(new Error('network error'));
    expect(await getServerFeatureFlag('ai_chat_enabled', 'user-1')).toBe(false);
  });

  it('calls shutdown regardless of outcome via finally', async () => {
    mockGetFeatureFlag.mockResolvedValue(true);
    await getServerFeatureFlag('document_upload_enabled', 'user-1');
    expect(mockShutdown).toHaveBeenCalledOnce();
  });

  it('returns false (default) and skips PostHog when no key configured', async () => {
    mockEnv.POSTHOG_PERSONAL_API_KEY = undefined;
    mockEnv.NEXT_PUBLIC_POSTHOG_KEY = undefined;
    expect(await getServerFeatureFlag('document_upload_enabled', 'user-1')).toBe(false);
    expect(MockPostHog).not.toHaveBeenCalled();
  });
});
