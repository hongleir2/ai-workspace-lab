import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  level?: 2 | 3;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
  level = 2,
}: SectionHeaderProps) {
  const Heading = level === 3 ? 'h3' : 'h2';

  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <Heading className="text-lg font-semibold tracking-tight text-foreground">{title}</Heading>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
