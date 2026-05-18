import { logger } from '@/lib/axiom/server';
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
  const workerUrl = `${appUrl()}/api/internal/run-worker`;

  if (!token) {
    logger.debug('worker.trigger.skipped', {
      reason: 'no_qstash_token',
      workerUrl,
      hasWorkerSecret: !!env.WORKER_SECRET,
    });
    return;
  }

  logger.debug('worker.trigger.sending', {
    workerUrl,
    hasWorkerSecret: !!env.WORKER_SECRET,
  });

  const client = new Client({ token });
  const headers: Record<string, string> = {};
  if (env.WORKER_SECRET) {
    headers['Authorization'] = `Bearer ${env.WORKER_SECRET}`;
  }

  try {
    await client.publishJSON({
      url: workerUrl,
      headers,
      body: {},
    });
    logger.debug('worker.trigger.sent', { workerUrl });
  } catch (err) {
    logger.error('worker.trigger.failed', {
      workerUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
