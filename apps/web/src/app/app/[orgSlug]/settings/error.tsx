'use client';

import * as Sentry from '@sentry/nextjs';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface SettingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SettingsError({ error, reset }: SettingsErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{'Failed to load settings'}</p>
        <p className="text-xs text-muted-foreground">{'Something went wrong. Please try again.'}</p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        {'Try again'}
      </Button>
    </div>
  );
}
