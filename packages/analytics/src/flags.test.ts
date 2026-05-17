import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockIsFeatureEnabled } = vi.hoisted(() => ({
  mockIsFeatureEnabled: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: { isFeatureEnabled: mockIsFeatureEnabled },
}));

Object.defineProperty(globalThis, 'window', { value: {}, writable: true });

import { FLAG_DEFAULTS, isFeatureEnabled } from './flags';

describe('isFeatureEnabled', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns PostHog value when flag is enabled', () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    expect(isFeatureEnabled('document_upload_enabled')).toBe(true);
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('document_upload_enabled');
  });

  it('returns FLAG_DEFAULTS when PostHog returns undefined', () => {
    mockIsFeatureEnabled.mockReturnValue(undefined);
    expect(isFeatureEnabled('ai_chat_enabled')).toBe(FLAG_DEFAULTS['ai_chat_enabled']);
  });

  it('returns FLAG_DEFAULTS when window is undefined (server-side)', () => {
    const original = (globalThis as Record<string, unknown>)['window'];
    Object.defineProperty(globalThis, 'window', { value: undefined, writable: true });
    expect(isFeatureEnabled('document_upload_enabled')).toBe(false);
    expect(mockIsFeatureEnabled).not.toHaveBeenCalled();
    Object.defineProperty(globalThis, 'window', { value: original, writable: true });
  });
});
