import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  error?: Error | string;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
  error,
  className,
}: ErrorStateProps) {
  const resolvedDescription =
    description ?? (typeof error === 'string' ? error : error?.message) ?? undefined;

  return (
    <Alert
      variant="destructive"
      className={cn('flex flex-col gap-3 transition-colors duration-200', className)}
    >
      <AlertTriangle className="size-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      {resolvedDescription ? <AlertDescription>{resolvedDescription}</AlertDescription> : null}
      {action ? <div className="pl-7">{action}</div> : null}
    </Alert>
  );
}
