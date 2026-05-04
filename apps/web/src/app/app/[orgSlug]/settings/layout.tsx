import { SettingsNav } from '@/components/nav/settings-nav';
import type { ReactNode } from 'react';

interface SettingsLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { orgSlug } = await params;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{'Settings'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {'Manage your organization preferences.'}
        </p>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <SettingsNav orgSlug={orgSlug} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
