'use client';

import posthog from 'posthog-js';

export type FeatureFlag =
  | 'document_upload_enabled'
  | 'ai_chat_enabled'
  | 'rag_v1_enabled'
  | 'desktop_upload_enabled'
  | 'realtime_status_enabled';

export const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  document_upload_enabled: false,
  ai_chat_enabled: false,
  rag_v1_enabled: false,
  desktop_upload_enabled: false,
  realtime_status_enabled: false,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (typeof window === 'undefined') return FLAG_DEFAULTS[flag];
  return posthog.isFeatureEnabled(flag) ?? FLAG_DEFAULTS[flag];
}
