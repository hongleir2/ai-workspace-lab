import { logger } from '@/lib/axiom/server';
import { env } from '@/lib/env';
import { runWorkerOnce } from '@ai-workspace-lab/jobs';
import { Receiver } from '@upstash/qstash';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const qstashSignature = request.headers.get('upstash-signature');

  if (qstashSignature) {
    const currentKey = env.QSTASH_CURRENT_SIGNING_KEY;
    const nextKey = env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentKey || !nextKey) return false;
    const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    const body = await request.text();
    return receiver.verify({ signature: qstashSignature, body }).catch(() => false);
  }

  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) {
    return true;
  }

  const workerSecret = env.WORKER_SECRET;
  if (workerSecret) {
    return request.headers.get('authorization') === `Bearer ${workerSecret}`;
  }

  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const traceId = (await headers()).get('x-trace-id') ?? undefined;

  if (!(await isAuthorized(request))) {
    logger.warn('worker.unauthorized', { traceId });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('worker.triggered', { traceId });

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
