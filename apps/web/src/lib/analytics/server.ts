import { env } from '@/lib/env';
import { PostHog } from 'posthog-node';

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const client = new PostHog(key, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
  client.capture({ distinctId, event, ...(properties !== undefined ? { properties } : {}) });
  await client.shutdown();
}
