'use server';

import * as Sentry from '@sentry/nextjs';

export async function triggerServerSentryTest(): Promise<string> {
  const error = new Error('Sentry server test error');
  const eventId = Sentry.captureException(error, {
    tags: {
      source: 'dev-sentry-test',
      runtime: 'server',
    },
  });

  await Sentry.flush(2000);
  return eventId;
}
