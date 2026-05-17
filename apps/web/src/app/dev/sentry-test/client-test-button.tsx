'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { triggerServerSentryTest } from './actions';

export function ClientErrorButton() {
  return (
    <Button
      type="button"
      variant="destructive"
      onClick={() => {
        throw new Error('Sentry client test error');
      }}
    >
      {'Trigger client error'}
    </Button>
  );
}

export function ServerErrorButton() {
  const [isPending, startTransition] = useTransition();
  const [eventId, setEventId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const nextEventId = await triggerServerSentryTest();
            setEventId(nextEventId);
          });
        }}
      >
        {isPending ? 'Sending server error' : 'Trigger server error'}
      </Button>
      {eventId ? (
        <p className="font-mono text-xs text-muted-foreground">{`event id: ${eventId}`}</p>
      ) : null}
    </div>
  );
}
