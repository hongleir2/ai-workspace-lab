export const FEATURE_KEYS = {
  DOCUMENT_UPLOADS: 'document_uploads',
  AI_MESSAGES: 'ai_messages',
  MAX_FILE_SIZE_MB: 'max_file_size_mb',
  DOCUMENT_EMBEDDINGS: 'document_embeddings',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];
