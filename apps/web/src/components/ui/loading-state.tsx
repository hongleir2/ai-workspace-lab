import { Loader2 } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  rows?: number;
  className?: string;
  variant?: 'spinner' | 'skeleton';
}

export function LoadingState({
  message,
  rows = 3,
  className,
  variant = 'skeleton',
}: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <output
        className={cn(
          'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
          className,
        )}
        aria-live="polite"
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </output>
    );
  }

  const rowCount = Math.max(1, rows);
  const widths = ['w-full', 'w-11/12', 'w-10/12', 'w-9/12', 'w-8/12'];

  return (
    <output
      className={cn('flex flex-col gap-3', className)}
      aria-live="polite"
      aria-label={message ?? 'Loading'}
    >
      {Array.from({ length: rowCount }).map((_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows are static placeholders
          key={index}
          className={cn('h-4', widths[index % widths.length])}
        />
      ))}
      {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
    </output>
  );
}
