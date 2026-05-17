'use server';

import { captureServerEvent } from '@/lib/analytics/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/sign-in?error=missing_fields');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    await captureServerEvent(data.user.id, 'user_signed_in', { email });
  }

  redirect('/app');
}
