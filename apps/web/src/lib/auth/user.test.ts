/**
 * Unit tests for the auth-logic layer (lib/auth/user.ts).
 *
 * These tests mock the Supabase server client to isolate redirect rules,
 * upsert payload correctness, and disabled-account handling. They do NOT
 * test the database schema or RLS policies — that is covered by the
 * integration tests in packages/db/src/schema/users.test.ts which run
 * against a real Postgres instance.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// next/navigation's redirect() throws a special error in the real Next.js
// runtime. We replicate that throw so code after redirect() doesn't run.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/supabase/server');

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, requireUser, syncAuthUserToDatabase } from './user';

const mockCreateClient = vi.mocked(createClient);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUTH_UID = 'supabase-auth-uid-001';

const authUser = {
  id: AUTH_UID,
  email: 'test@example.com',
  user_metadata: {},
};

function dbRow(overrides: { status?: 'active' | 'disabled' | 'deleted' } = {}) {
  return {
    id: 'db-user-id-001',
    auth_provider: 'supabase',
    auth_provider_user_id: AUTH_UID,
    email: 'test@example.com',
    display_name: null,
    avatar_url: null,
    timezone: null,
    status: 'active' as const,
    last_seen_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

// ── Mock Supabase client builder ───────────────────────────────────────────────
//
// user.ts uses two distinct Supabase query chains:
//   SELECT path:  from('users').select('*').eq().eq().eq().maybeSingle()
//   UPSERT path:  from('users').upsert({...}).select('*').single()
//
// The factory below wires both so each test can choose which path resolves.

function makeClient({
  sessionUser = null as typeof authUser | null,
  selectData = null as ReturnType<typeof dbRow> | null,
  upsertData = null as ReturnType<typeof dbRow> | null,
  upsertError = null as { message: string } | null,
} = {}) {
  const eqChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: selectData, error: null }),
  };

  const upsertSingleChain = {
    single: vi.fn().mockResolvedValue({ data: upsertData, error: upsertError }),
  };
  const upsertFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue(upsertSingleChain),
  });

  const fromMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue(eqChain),
    upsert: upsertFn,
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: sessionUser }, error: null }),
    },
    from: fromMock,
    // expose internals for payload assertions
    _upsertFn: upsertFn,
  };
}

// ── getCurrentUser ────────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when there is no active auth session', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ sessionUser: null }) as never);
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null when the db row has status disabled', async () => {
    // maybeSingle returns null because the .eq(status, 'active') filter finds nothing
    mockCreateClient.mockResolvedValue(
      makeClient({ sessionUser: authUser, selectData: null }) as never,
    );
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns the mapped User when session is active and row exists', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ sessionUser: authUser, selectData: dbRow() }) as never,
    );
    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.email).toBe('test@example.com');
    expect(user?.status).toBe('active');
    expect(user?.authProvider).toBe('supabase');
  });
});

// ── requireUser / syncAuthUserToDatabase ──────────────────────────────────────

describe('requireUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to /sign-in when there is no auth session (protected route blocked)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ sessionUser: null }) as never);
    await expect(requireUser()).rejects.toThrow('REDIRECT:/sign-in');
  });

  it('returns the synced User when the session is active', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ sessionUser: authUser, upsertData: dbRow() }) as never,
    );
    const user = await requireUser();
    expect(user.email).toBe('test@example.com');
    expect(user.status).toBe('active');
    expect(user.authProvider).toBe('supabase');
    expect(user.authProviderUserId).toBe(AUTH_UID);
  });
});

describe('syncAuthUserToDatabase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts with provider identity fields and excludes status', async () => {
    const client = makeClient({ sessionUser: authUser, upsertData: dbRow() });
    mockCreateClient.mockResolvedValue(client as never);

    await syncAuthUserToDatabase();

    // Verify the upsert was called on the users table
    expect(client.from).toHaveBeenCalledWith('users');
    const payload = client._upsertFn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['auth_provider']).toBe('supabase');
    expect(payload['auth_provider_user_id']).toBe(AUTH_UID);
    expect(payload['email']).toBe('test@example.com');
    expect(payload['last_seen_at']).toBeDefined();
    // status must NOT be in the payload — overwriting it would re-enable disabled accounts
    expect(payload).not.toHaveProperty('status');
  });

  it('redirects to /sign-in?error=account_disabled when account is disabled', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ sessionUser: authUser, upsertData: dbRow({ status: 'disabled' }) }) as never,
    );
    await expect(syncAuthUserToDatabase()).rejects.toThrow(
      'REDIRECT:/sign-in?error=account_disabled',
    );
  });

  it('throws when the upsert returns a database error', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        sessionUser: authUser,
        upsertData: null,
        upsertError: { message: 'permission denied' },
      }) as never,
    );
    await expect(syncAuthUserToDatabase()).rejects.toThrow('Failed to sync app user');
  });
});
