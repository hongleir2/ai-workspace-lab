'use client';

import { AlertTriangle, BarChart3, CreditCard, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface SettingsNavProps {
  orgSlug: string;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav({ orgSlug }: SettingsNavProps) {
  const pathname = usePathname() ?? '';
  const base = `/app/${orgSlug}/settings`;

  const mainItems = [
    { label: 'General', href: `${base}/general`, icon: Settings },
    { label: 'Members', href: `${base}/members`, icon: Users },
    { label: 'Usage', href: `${base}/usage`, icon: BarChart3 },
    { label: 'Billing', href: `${base}/billing`, icon: CreditCard },
  ];

  return (
    <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible">
      {mainItems.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
            isActive(pathname, href)
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{label}</span>
        </Link>
      ))}

      <div className="my-1 hidden h-px bg-border sm:block" />

      <Link
        href={`${base}/danger`}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          isActive(pathname, `${base}/danger`)
            ? 'bg-destructive/10 text-destructive font-medium'
            : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
        )}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">Danger Zone</span>
      </Link>
    </nav>
  );
}
