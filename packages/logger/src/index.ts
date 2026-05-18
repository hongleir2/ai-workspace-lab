import { Axiom } from '@axiomhq/js';
import { AxiomJSTransport, ConsoleTransport, Logger } from '@axiomhq/logging';

// Debug logs are sent in dev (local) and preview deployments, not production.
// VERCEL_ENV is unset locally, set to "preview" or "production" on Vercel.
const isProduction = process.env['VERCEL_ENV'] === 'production';

const axiomClient = process.env['AXIOM_TOKEN']
  ? new Axiom({ token: process.env['AXIOM_TOKEN'] })
  : null;

const baseTransport =
  axiomClient && process.env['AXIOM_DATASET']
    ? new AxiomJSTransport({ axiom: axiomClient, dataset: process.env['AXIOM_DATASET'] })
    : new ConsoleTransport();

const rootLogger = new Logger({
  transports: [baseTransport],
  // Only emit debug logs in non-production environments (local dev and preview deployments).
  logLevel: isProduction ? 'info' : 'debug',
});

export function createLogger(module: string, context?: Record<string, unknown>): Logger {
  return rootLogger.with({ module, ...context });
}

export type { Logger };
