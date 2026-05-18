'use client';

import { FLAGS } from '@ai-workspace-lab/analytics';
import { FileText, LayoutDashboard, Lock, MessageSquare, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';

import { OrganizationSwitcher } from '@/components/nav/organization-switcher';
import { PlanBadge } from '@/components/nav/plan-badge';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface OrgEntry {
  slug: string;
  name: string;
}

interface AppSidebarProps {
  orgSlug: string;
  orgName: string;
  allOrgs: OrgEntry[];
  planId: string;
  planName: string;
  subscriptionStatus: string;
  daysLeft?: number;
  className?: string;
  /** Feature keys that are disabled for this user/org */
  disabledFeatures?: Set<string>;
}

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
  featureKey?: string;
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
        {
          label: 'Documents',
          href: `${base}/documents`,
          icon: FileText,
          featureKey: FLAGS.DOCUMENT_UPLOAD,
        },
        {
          label: 'AI Chat',
          href: `${base}/ai`,
          icon: MessageSquare,
          featureKey: FLAGS.AI_CHAT,
        },
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

export function AppSidebar({
  orgSlug,
  orgName,
  allOrgs,
  planId,
  planName,
  subscriptionStatus,
  daysLeft,
  className,
  disabledFeatures,
}: AppSidebarProps) {
  const pathname = usePathname() ?? '';
  const sections = buildSections(orgSlug);

  return (
    <aside
      className={cn(
        'hidden md:flex w-60 shrink-0 h-full flex-col gap-4 border-r border-border bg-background p-3',
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
              const disabled = item.featureKey
                ? (disabledFeatures?.has(item.featureKey) ?? false)
                : false;

              if (disabled) {
                return (
                  <Tooltip key={item.href} content="Not available on your current plan">
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'rounded-md px-3 py-2 flex items-center gap-2 text-sm cursor-not-allowed opacity-50',
                          'text-muted-foreground',
                        )}
                        aria-disabled="true"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <Lock className="h-3 w-3 shrink-0" />
                      </div>
                    </TooltipTrigger>
                  </Tooltip>
                );
              }

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
        <PlanBadge
          orgSlug={orgSlug}
          planId={planId}
          planName={planName}
          subscriptionStatus={subscriptionStatus}
          {...(daysLeft !== undefined ? { daysLeft } : {})}
        />
      </div>
    </aside>
  );
}
