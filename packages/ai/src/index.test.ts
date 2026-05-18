import { describe, expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({
    embedding: vi.fn().mockReturnValue('mock-embedding-model'),
  })),
}));

vi.mock('ai', () => ({
  streamText: vi.fn().mockReturnValue({
    toDataStreamResponse: vi.fn().mockReturnValue(new Response('ok')),
  }),
  embedMany: vi.fn(),
  embed: vi.fn(),
}));

import {
  AiError,
  buildPromptFromMessages,
  estimateCost,
  estimateEmbeddingCost,
  generateEmbeddings,
  normalizeTokenUsage,
} from './index';

describe('normalizeTokenUsage', () => {
  it('maps promptTokens to inputTokens and completionTokens to outputTokens', () => {
    const result = normalizeTokenUsage({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
    expect(result).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
  });

  it('replaces NaN values with 0 and derives totalTokens when all are NaN', () => {
    const result = normalizeTokenUsage({
      promptTokens: Number.NaN,
      completionTokens: Number.NaN,
      totalTokens: Number.NaN,
    });
    expect(result).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it('derives totalTokens from input+output when totalTokens is NaN but others are valid', () => {
    const result = normalizeTokenUsage({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: Number.NaN,
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

describe('generateEmbeddings', () => {
  it('returns empty result for empty input', async () => {
    const result = await generateEmbeddings([], 'sk-test');
    expect(result).toEqual({ embeddings: [], tokens: 0 });
  });

  it('throws CONFIGURATION_ERROR when apiKey is empty', async () => {
    await expect(generateEmbeddings(['text'], '')).rejects.toThrow(AiError);
  });

  it('calls embedMany and returns embeddings and token count', async () => {
    const { embedMany } = await import('ai');
    const mockEmbeddings = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    vi.mocked(embedMany).mockResolvedValueOnce({
      embeddings: mockEmbeddings,
      usage: { tokens: 20 },
      values: ['a', 'b'],
      doEmbed: vi.fn(),
      rawResponse: undefined,
      warnings: undefined,
    } as never);
    const result = await generateEmbeddings(['text a', 'text b'], 'sk-test');
    expect(result.embeddings).toEqual(mockEmbeddings);
    expect(result.tokens).toBe(20);
  });
});

describe('estimateEmbeddingCost', () => {
  it('computes micro-USD cost at $0.02/million tokens', () => {
    expect(estimateEmbeddingCost(1_000_000)).toBe(20_000);
    expect(estimateEmbeddingCost(0)).toBe(0);
    expect(estimateEmbeddingCost(500)).toBe(10);
  });
});
