'use client';

import { Logger, ProxyTransport } from '@axiomhq/logging';
import { createUseLogger, createWebVitalsComponent } from '@axiomhq/react';

// Uses ProxyTransport so AXIOM_TOKEN never appears in the browser bundle —
// all log payloads are forwarded through /api/axiom server-side.
export const logger = new Logger({
  transports: [new ProxyTransport({ url: '/api/axiom', autoFlush: true })],
});

export const useLogger = createUseLogger(logger);
export const WebVitals = createWebVitalsComponent(logger);
