import { env } from '@/lib/env';
import { PostHog } from 'posthog-node';

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const key = env.POSTHOG_PERSONAL_API_KEY ?? env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const client = new PostHog(key, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
  try {
    client.capture({ distinctId, event, ...(properties !== undefined ? { properties } : {}) });
    await client.shutdown();
  } catch {
    // Analytics failures must not degrade the primary user flow.
  }
}
