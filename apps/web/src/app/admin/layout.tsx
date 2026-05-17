import { AdminSidebar } from '@/components/nav/admin-sidebar';
import { requirePlatformAdmin } from '@/lib/auth/admin';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <span className="font-display text-sm font-semibold tracking-tight">Platform Admin</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
