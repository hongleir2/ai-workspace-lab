import { MarketingFooter } from '@/components/nav/marketing-footer';
import { MarketingHeader } from '@/components/nav/marketing-header';
import type { ReactNode } from 'react';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#070a15]">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
