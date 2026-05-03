import { createClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Only allow same-origin internal paths (e.g. "/app", "/settings"). A leading
// "//" or "/\" would resolve as protocol-relative and could redirect off-site.
function safeNext(raw: string | null): string {
  if (raw === null) return '/app';
  if (!raw.startsWith('/')) return '/app';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/app';
  return raw;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const params = new URLSearchParams({ error: error.message });
      return NextResponse.redirect(new URL(`/sign-in?${params.toString()}`, origin));
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
