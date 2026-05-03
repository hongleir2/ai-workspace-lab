'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface OrganizationSwitcherProps {
  orgSlug: string;
  className?: string;
}

interface OrgEntry {
  slug: string;
  name: string;
}

const orgs: OrgEntry[] = [
  { slug: 'acme', name: 'Acme Inc' },
  { slug: 'globex', name: 'Globex' },
  { slug: 'initech', name: 'Initech' },
];

function getInitials(slug: string) {
  const cleaned = slug.replace(/[^a-zA-Z0-9]/g, '');
  if (cleaned.length === 0) return 'OR';
  if (cleaned.length === 1) return cleaned.toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

function getDisplayName(slug: string) {
  const match = orgs.find((o) => o.slug === slug);
  if (match) return match.name;
  return slug
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function OrganizationSwitcher({ orgSlug, className }: OrganizationSwitcherProps) {
  const initials = getInitials(orgSlug);
  const displayName = getDisplayName(orgSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full h-12 bg-card border border-border rounded-md px-3 flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent',
            className,
          )}
        >
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/80 to-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-sm font-medium truncate w-full text-left">{displayName}</span>
            <span className="text-xs font-mono text-muted-foreground truncate w-full text-left">
              {orgSlug}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        {orgs.map((org) => {
          const isCurrent = org.slug === orgSlug;
          return (
            <DropdownMenuItem key={org.slug} className="cursor-pointer">
              <div className="h-6 w-6 rounded bg-gradient-to-br from-primary/80 to-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">
                {getInitials(org.slug)}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm truncate">{org.name}</span>
                <span className="text-xs font-mono text-muted-foreground truncate">{org.slug}</span>
              </div>
              {isCurrent ? <Check className="h-4 w-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <Plus className="h-4 w-4" />
          <span className="text-sm">Create new organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
