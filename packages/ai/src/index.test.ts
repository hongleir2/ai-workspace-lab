import { describe, expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn().mockReturnValue('mock-model')),
}));

vi.mock('ai', () => ({
  streamText: vi.fn().mockReturnValue({
    toDataStreamResponse: vi.fn().mockReturnValue(new Response('ok')),
  }),
}));

import { AiError, buildPromptFromMessages, estimateCost, normalizeTokenUsage } from './index';

describe('normalizeTokenUsage', () => {
  it('maps promptTokens to inputTokens and completionTokens to outputTokens', () => {
    const result = normalizeTokenUsage({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
    expect(result).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
  });
});

describe('estimateCost', () => {
  it('returns 0 for unknown model', () => {
    expect(estimateCost('unknown-model', 1000, 500)).toBe(0);
  });

  it('computes gpt-4o-mini cost in micro-USD', () => {
    expect(estimateCost('gpt-4o-mini', 1000, 500)).toBe(450);
  });

  it('computes gpt-4o cost in micro-USD', () => {
    expect(estimateCost('gpt-4o', 1000, 500)).toBe(7500);
  });
});

describe('buildPromptFromMessages', () => {
  it('passes messages through with correct roles', () => {
    const msgs = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi' },
    ];
    expect(buildPromptFromMessages(msgs)).toEqual(msgs);
  });

  it('returns empty array for empty input', () => {
    expect(buildPromptFromMessages([])).toEqual([]);
  });
});

describe('AiError', () => {
  it('has name AiError and correct code', () => {
    const err = new AiError('no key', 'CONFIGURATION_ERROR');
    expect(err.name).toBe('AiError');
    expect(err.code).toBe('CONFIGURATION_ERROR');
    expect(err).toBeInstanceOf(Error);
  });
});
