'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <AlertCircle className="h-9 w-9 text-destructive" />
        <div className="space-y-2">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            {'Something went wrong'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {'The app hit an unexpected error. Try again, or come back in a moment.'}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={reset}>
          {'Try again'}
        </Button>
      </div>
    </main>
  );
}
