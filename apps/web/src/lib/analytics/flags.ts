import { env } from '@/lib/env';
import { FLAG_DEFAULTS } from '@ai-workspace-lab/analytics/flag-definitions';
import type { FeatureFlag } from '@ai-workspace-lab/analytics/flag-definitions';
import { PostHog } from 'posthog-node';

export { FLAGS } from '@ai-workspace-lab/analytics/flag-definitions';

export async function getServerFeatureFlag(
  flag: FeatureFlag,
  distinctId: string,
): Promise<boolean> {
  const projectKey = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!projectKey) return FLAG_DEFAULTS[flag];

  const client = new PostHog(projectKey, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    ...(env.POSTHOG_PERSONAL_API_KEY ? { personalApiKey: env.POSTHOG_PERSONAL_API_KEY } : {}),
    flushAt: 1,
    flushInterval: 0,
    sendFeatureFlagEvent: false,
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
