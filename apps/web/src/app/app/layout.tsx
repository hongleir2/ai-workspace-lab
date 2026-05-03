import { signOutAction } from '@/app/(auth)/sign-out/actions';
import { requireUser } from '@/lib/auth/user';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

interface AppLayoutProps {
  children: ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <p className="font-display font-semibold">AI Workspace</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action={signOutAction}>
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted" type="submit">
            Sign out
          </button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
