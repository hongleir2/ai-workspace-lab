'use client';

import { FileText, LayoutDashboard, MessageSquare, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';

import { OrganizationSwitcher } from '@/components/nav/organization-switcher';
import { PlanBadge } from '@/components/nav/plan-badge';
import { cn } from '@/lib/utils';

interface OrgEntry {
  slug: string;
  name: string;
}

interface AppSidebarProps {
  orgSlug: string;
  orgName: string;
  allOrgs: OrgEntry[];
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

function buildSections(orgSlug: string): NavSection[] {
  const base = `/app/${orgSlug}`;
  return [
    {
      title: 'Workspace',
      items: [
        { label: 'Dashboard', href: base, icon: LayoutDashboard, exact: true },
        { label: 'Documents', href: `${base}/documents`, icon: FileText },
        { label: 'AI Chat', href: `${base}/ai`, icon: MessageSquare },
      ],
    },
    {
      title: 'Settings',
      items: [{ label: 'Settings', href: `${base}/settings`, icon: Settings }],
    },
  ];
}

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ orgSlug, orgName, allOrgs, className }: AppSidebarProps) {
  const pathname = usePathname() ?? '';
  const sections = buildSections(orgSlug);

  return (
    <aside
      className={cn(
        'hidden md:flex w-60 shrink-0 min-h-screen flex-col gap-4 border-r border-border bg-background p-3',
        className,
      )}
    >
      <OrganizationSwitcher orgSlug={orgSlug} orgName={orgName} allOrgs={allOrgs} />
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
      <div className="mt-auto">
        <PlanBadge />
      </div>
    </aside>
  );
}
