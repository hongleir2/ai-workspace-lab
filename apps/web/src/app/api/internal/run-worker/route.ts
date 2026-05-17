import { env } from '@/lib/env';
import { runWorkerOnce } from '@ai-workspace-lab/jobs';
import { Receiver } from '@upstash/qstash';
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

  const secret = env.WORKER_SECRET;
  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`;
  }

  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runWorkerOnce();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
