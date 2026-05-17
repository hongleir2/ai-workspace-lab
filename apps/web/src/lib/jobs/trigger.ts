import { appUrl, env } from '@/lib/env';
import { Client } from '@upstash/qstash';

/**
 * Publishes a QStash message to run-worker so the next pending job is processed
 * immediately after enqueue. Fire-and-forget — the DB job queue is the source of
 * truth; QStash is a fast-path trigger, not a requirement.
 *
 * No-ops silently when QSTASH_TOKEN is not configured (local dev without QStash,
 * or during CI).
 */
export async function triggerWorker(): Promise<void> {
  const token = env.QSTASH_TOKEN;
  if (!token) return;

  const client = new Client({ token });
  const headers: Record<string, string> = {};
  if (env.WORKER_SECRET) {
    headers['Authorization'] = `Bearer ${env.WORKER_SECRET}`;
  }

  await client.publishJSON({
    url: `${appUrl()}/api/internal/run-worker`,
    headers,
    body: {},
  });
}
