import { env } from '@/lib/env';
import type { FeatureFlag } from '@ai-workspace-lab/analytics';
import { PostHog } from 'posthog-node';

const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  document_upload_enabled: false,
  ai_chat_enabled: false,
  rag_v1_enabled: false,
  desktop_upload_enabled: false,
  realtime_status_enabled: false,
};

export async function getServerFeatureFlag(
  flag: FeatureFlag,
  distinctId: string,
): Promise<boolean> {
  const key = env.POSTHOG_PERSONAL_API_KEY ?? env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return FLAG_DEFAULTS[flag];

  const client = new PostHog(key, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });

  try {
    const value = await client.getFeatureFlag(flag, distinctId);
    return Boolean(value ?? FLAG_DEFAULTS[flag]);
  } catch {
    return FLAG_DEFAULTS[flag];
  } finally {
    await client.shutdown().catch(() => {});
  }
}
