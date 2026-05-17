'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <section style={{ maxWidth: '420px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', lineHeight: 1.2, margin: 0 }}>
              {'Something went wrong'}
            </h1>
            <p style={{ color: '#52525b', fontSize: '14px', lineHeight: 1.6 }}>
              {'Refresh the page and try again.'}
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
