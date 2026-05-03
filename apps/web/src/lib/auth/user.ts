import { createClient } from '@/lib/supabase/server';
import type { User } from '@ai-workspace-lab/db';
import { redirect } from 'next/navigation';

// ── Local type mirroring the DB row returned by supabase-js (snake_case) ────
interface UserRow {
  id: string;
  auth_provider: string;
  auth_provider_user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  status: 'active' | 'disabled' | 'deleted';
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    authProvider: row.auth_provider,
    authProviderUserId: row.auth_provider_user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    timezone: row.timezone,
    status: row.status,
    lastSeenAt: row.last_seen_at !== null ? new Date(row.last_seen_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at !== null ? new Date(row.deleted_at) : null,
  };
}

/**
 * Returns the current *active* app user from the database, or null if:
 *  - No active Supabase auth session
 *  - Session exists but the user row hasn't been synced yet (first-login race)
 *  - Row exists but status !== 'active' (disabled / deleted)
 *
 * The status filter is the contract that lets /sign-in and /sign-up call this
 * for redirect-when-signed-in without bouncing disabled users to /app, where
 * `requireUser()` would just send them right back here — an infinite loop.
 * `requireUser()` remains the canonical gatekeeper for protected routes.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_provider', 'supabase')
    .eq('auth_provider_user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle<UserRow>();

  return data !== null ? rowToUser(data) : null;
}

/**
 * Upserts the Supabase auth user into the app users table and returns the row.
 * Redirects to /sign-in if the user is not authenticated.
 * Redirects to /sign-in?error=account_disabled if the account is not active.
 * Throws if the auth user has no email address.
 */
export async function syncAuthUserToDatabase(): Promise<User> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect('/sign-in');
  }

  const authUser = authData.user;
  if (!authUser.email) {
    throw new Error('Auth user has no email address');
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        auth_provider: 'supabase',
        auth_provider_user_id: authUser.id,
        email: authUser.email,
        display_name:
          (authUser.user_metadata?.['full_name'] as string | undefined) ??
          (authUser.user_metadata?.['name'] as string | undefined) ??
          null,
        avatar_url:
          (authUser.user_metadata?.['avatar_url'] as string | undefined) ??
          (authUser.user_metadata?.['picture'] as string | undefined) ??
          null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'auth_provider,auth_provider_user_id' },
    )
    .select('*')
    .single<UserRow>();

  if (error) {
    throw new Error(`Failed to sync app user: ${error.message}`);
  }

  if (data.status !== 'active') {
    redirect('/sign-in?error=account_disabled');
  }

  return rowToUser(data);
}

/**
 * Ensures the calling route has an authenticated, active app user.
 * Delegates all redirects to syncAuthUserToDatabase.
 */
export async function requireUser(): Promise<User> {
  return syncAuthUserToDatabase();
}
