import { createOpenAI } from '@ai-sdk/openai';
import { embedMany, streamText } from 'ai';
import type { AiCompletionOptions, AiFinishEvent, NormalizedUsage } from './types';

export type { AiCompletionOptions, AiFinishEvent, NormalizedUsage };
export {
  type EmbedResult,
  type RagChunk,
  type RetrieveOptions,
  embedQuery,
  validateRagScope,
  retrieveRelevantChunks,
  buildContextBlock,
} from './retrieval';

type StreamTextOptions = Parameters<typeof streamText>[0];
type StreamTextFinishEvent = Parameters<NonNullable<StreamTextOptions['onFinish']>>[0];

export class AiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PROVIDER_ERROR'
      | 'CONTEXT_LIMIT'
      | 'RATE_LIMITED'
      | 'CONFIGURATION_ERROR',
  ) {
    super(message);
    this.name = 'AiError';
  }
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return Math.round(pricing.input * inputTokens + pricing.output * outputTokens);
}

export function normalizeTokenUsage(usage: {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}): NormalizedUsage {
  const input = Number.isFinite(usage.promptTokens) ? usage.promptTokens : 0;
  const output = Number.isFinite(usage.completionTokens) ? usage.completionTokens : 0;
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: Number.isFinite(usage.totalTokens) ? usage.totalTokens : input + output,
  };
}

export function buildPromptFromMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export function streamChatCompletion(opts: AiCompletionOptions) {
  if (!opts.apiKey) {
    throw new AiError('OPENAI_API_KEY is not configured', 'CONFIGURATION_ERROR');
  }

  const openaiClient = createOpenAI({ apiKey: opts.apiKey });
  const modelId = opts.model ?? 'gpt-4o-mini';

  const streamOptions = {
    model: openaiClient(modelId),
    messages: opts.messages,
    ...(opts.system ? { system: opts.system } : {}),
    maxTokens: opts.maxTokens ?? 4096,
    ...(opts.onFinish
      ? {
          onFinish: async (event: StreamTextFinishEvent) => {
            await (opts.onFinish as (event: AiFinishEvent) => Promise<void> | void)({
              text: event.text,
              usage: {
                promptTokens: event.usage.promptTokens,
                completionTokens: event.usage.completionTokens,
                totalTokens: event.usage.totalTokens,
              },
              finishReason: event.finishReason,
            });
          },
        }
      : {}),
  };

  return streamText(streamOptions);
}

export const EMBEDDING_MODEL = 'text-embedding-3-small';

// $0.02 per million tokens → micro-USD per token = 0.02
export function estimateEmbeddingCost(tokens: number): number {
  return Math.round(0.02 * tokens);
}

export interface EmbeddingResult {
  embeddings: number[][];
  tokens: number;
}

export async function generateEmbeddings(
  texts: string[],
  apiKey: string,
): Promise<EmbeddingResult> {
  if (!apiKey) {
    throw new AiError('OPENAI_API_KEY is not configured', 'CONFIGURATION_ERROR');
  }
  if (texts.length === 0) {
    return { embeddings: [], tokens: 0 };
  }
  const openaiClient = createOpenAI({ apiKey });
  const { embeddings, usage } = await embedMany({
    model: openaiClient.embedding(EMBEDDING_MODEL),
    values: texts,
    maxRetries: 2,
  });
  return { embeddings, tokens: usage.tokens };
}
