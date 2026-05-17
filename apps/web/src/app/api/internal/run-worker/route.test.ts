import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ai-workspace-lab/jobs', () => ({
  runWorkerOnce: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { WORKER_SECRET: undefined as string | undefined },
}));

import { env } from '@/lib/env';
import { runWorkerOnce } from '@ai-workspace-lab/jobs';
import { NextRequest } from 'next/server';
import { POST } from './route';

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new NextRequest('http://localhost/api/internal/run-worker', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/internal/run-worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as { WORKER_SECRET: string | undefined }).WORKER_SECRET = undefined;
  });

  it('returns 200 with worker result when no secret is configured', async () => {
    vi.mocked(runWorkerOnce).mockResolvedValue({ processed: 0 });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ processed: 0 });
  });

  it('returns 200 when correct bearer token is provided', async () => {
    (env as { WORKER_SECRET: string | undefined }).WORKER_SECRET = 'supersecret';
    vi.mocked(runWorkerOnce).mockResolvedValue({ processed: 1, status: 'completed' });

    const res = await POST(makeRequest('Bearer supersecret'));

    expect(res.status).toBe(200);
  });

  it('returns 401 when secret is configured but no token provided', async () => {
    (env as { WORKER_SECRET: string | undefined }).WORKER_SECRET = 'supersecret';

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(runWorkerOnce).not.toHaveBeenCalled();
  });

  it('returns 401 when secret is configured and wrong token provided', async () => {
    (env as { WORKER_SECRET: string | undefined }).WORKER_SECRET = 'supersecret';

    const res = await POST(makeRequest('Bearer wrongtoken'));

    expect(res.status).toBe(401);
    expect(runWorkerOnce).not.toHaveBeenCalled();
  });

  it('returns 500 when runWorkerOnce throws', async () => {
    vi.mocked(runWorkerOnce).mockRejectedValue(new Error('DB connection lost'));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'DB connection lost' });
  });
});
