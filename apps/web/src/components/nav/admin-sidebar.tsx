'use client';

import { Activity, BarChart3, LayoutDashboard, Webhook } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'Jobs', href: '/admin/jobs', icon: Activity },
      { label: 'Webhooks', href: '/admin/webhooks/stripe', icon: Webhook },
    ],
  },
  {
    title: 'Billing',
    items: [{ label: 'Usage', href: '/admin/usage', icon: BarChart3 }],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname() ?? '';

  return (
    <aside
      className={cn(
        'hidden md:flex w-60 shrink-0 min-h-screen flex-col gap-4 border-r border-border bg-background p-3',
        className,
      )}
    >
      <div className="bg-card border border-destructive/30 rounded-md p-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
        <span className="text-sm font-medium">Platform Admin</span>
      </div>
      <nav className="flex flex-col gap-5">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-3 mb-1">
              {section.title}
            </h3>
            {section.items.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 flex items-center gap-2 text-sm transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto bg-destructive/5 border border-destructive/20 rounded-md p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Platform Admin</p>
        <p>Platform-wide tools. Actions affect all organizations.</p>
      </div>
    </aside>
  );
}
