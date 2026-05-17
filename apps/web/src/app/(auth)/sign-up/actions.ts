'use server';

import { captureServerEvent } from '@/lib/analytics/server';
import { appUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signUpAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/sign-up?error=missing_fields');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  // When email confirmation is required, data.user may be null (resend case).
  // Fall back to email as the PostHog distinct ID so the event always fires.
  await captureServerEvent(data.user?.id ?? email, 'user_signed_up', { email });

  redirect('/sign-in?message=check_email');
}
