import axiomClient from '@/lib/axiom/axiom';
import { env } from '@/lib/env';
import { AxiomJSTransport, ConsoleTransport, Logger } from '@axiomhq/logging';
import { createAxiomRouteHandler, createOnRequestError, nextJsFormatters } from '@axiomhq/nextjs';

// Debug logs are emitted in dev and preview deployments, not production.
// VERCEL_ENV is unset locally, set to "preview" or "production" on Vercel.
const isProduction = env.VERCEL_ENV === 'production';

// When AXIOM_TOKEN/DATASET are set, ship to Axiom; otherwise fall back to
// console output so local dev logs are still visible without requiring Axiom.
const transport =
  axiomClient && env.AXIOM_DATASET
    ? new AxiomJSTransport({ axiom: axiomClient, dataset: env.AXIOM_DATASET })
    : new ConsoleTransport();

export const logger = new Logger({
  transports: [transport],
  formatters: nextJsFormatters,
  // Only emit debug logs in non-production environments (local dev and preview deployments).
  logLevel: isProduction ? 'info' : 'debug',
});

export const withAxiom = createAxiomRouteHandler(logger);
export const onAxiomRequestError = createOnRequestError(logger);
