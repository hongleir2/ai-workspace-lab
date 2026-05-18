import { logger } from '@/lib/axiom/server';
import { env } from '@/lib/env';
import { runWorkerOnce } from '@ai-workspace-lab/jobs';
import { Receiver } from '@upstash/qstash';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function isAuthorized(request: NextRequest): Promise<{ ok: boolean; via?: string }> {
  const qstashSignature = request.headers.get('upstash-signature');

  if (qstashSignature) {
    const currentKey = env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentKey || !nextKey) return { ok: false, via: 'qstash_missing_keys' };
    const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    const body = await request.text();
    const ok = await receiver.verify({ signature: qstashSignature, body }).catch(() => false);
    return { ok, via: ok ? 'qstash_signature' : 'qstash_invalid_signature' };
  }

  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) {
    return { ok: true, via: 'cron_secret' };
  }

  const workerSecret = env.WORKER_SECRET;
  if (workerSecret) {
    const ok = request.headers.get('authorization') === `Bearer ${workerSecret}`;
    return { ok, via: ok ? 'worker_secret' : 'worker_secret_mismatch' };
  }

  return { ok: true, via: 'no_auth_configured' };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = (await headers()).get('x-trace-id') ?? undefined;

  const authResult = await isAuthorized(request);
  logger.debug('worker.auth_check', { traceId, via: authResult.via, ok: authResult.ok });

  if (!authResult.ok) {
    logger.warn('worker.unauthorized', { traceId, via: authResult.via });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('worker.triggered', { traceId, via: authResult.via });

  try {
    const startTime = Date.now();
    const result = await runWorkerOnce();

    if (result.processed === 0) {
      logger.info('worker.no_job', { traceId });
    } else {
      logger.info('worker.completed', {
        traceId,
        jobId: result.jobId,
        status: result.status,
        durationMs: Date.now() - startTime,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('worker.failed', { traceId, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
