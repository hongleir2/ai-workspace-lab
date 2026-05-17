import { env } from '@/lib/env';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Auth pages that signed-in users should never see
const AUTH_PAGES = new Set(['/sign-in', '/sign-up']);

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Refresh the Supabase session cookie on every request (required by @supabase/ssr)
  const response = await updateSession(request);

  // Redirect signed-in users away from auth pages at the edge so the browser
  // never renders a blank auth page before the server-side redirect fires.
  if (AUTH_PAGES.has(request.nextUrl.pathname)) {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {}, // read-only — updateSession above handles writes
        },
      });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
