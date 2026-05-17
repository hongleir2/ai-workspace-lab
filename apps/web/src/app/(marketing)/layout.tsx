import { MarketingFooter } from '@/components/nav/marketing-footer';
import { MarketingHeader } from '@/components/nav/marketing-header';
import type { ReactNode } from 'react';

// MarketingHeader calls getCurrentUser() which reads cookies at request time —
// static prerendering would throw when Supabase env vars are absent at build.
export const dynamic = 'force-dynamic';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
