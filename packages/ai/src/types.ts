export interface AiCompletionOptions {
  apiKey: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;
  system?: string;
  maxTokens?: number;
  onFinish?: (event: AiFinishEvent) => Promise<void> | void;
}

export interface AiFinishEvent {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
