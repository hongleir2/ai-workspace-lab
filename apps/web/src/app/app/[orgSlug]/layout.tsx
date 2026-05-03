import { AppSidebar } from '@/components/nav/app-sidebar';
import { AppTopbar } from '@/components/nav/app-topbar';
import type { ReactNode } from 'react';

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar orgSlug={orgSlug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar orgSlug={orgSlug} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
