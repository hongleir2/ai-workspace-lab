import { env } from '@/lib/env';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './user';

/**
 * Verifies the current user is a platform admin.
 * Redirects to /sign-in if not authenticated, /app if authenticated but not admin.
 *
 * Gate: email must appear in the ADMIN_EMAILS env var (comma-separated).
 * Temporary until a platform_admin flag is added to the users table (Sprint 11+).
 */
export async function requirePlatformAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const adminEmails = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(user.email.toLowerCase())) {
    redirect('/app');
  }
}
