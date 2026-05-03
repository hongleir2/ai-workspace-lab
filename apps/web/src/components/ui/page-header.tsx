import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 border-b border-border pb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-muted-foreground"
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {crumb.href && !isLast ? (
                  <a
                    href={crumb.href}
                    className="transition-colors duration-200 hover:text-foreground"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className={cn(isLast && 'text-foreground')}>{crumb.label}</span>
                )}
                {!isLast ? (
                  <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />
                ) : null}
              </span>
            );
          })}
        </nav>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
