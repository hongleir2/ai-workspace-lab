import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Single boot-time environment module for apps/web.
 *
 * Design contract (from CLAUDE.md §10):
 *   - Validate at boot — fail fast with a readable error on missing vars.
 *   - Read env in one place; never import process.env in feature code.
 *   - Server-only secrets never reach the client bundle.
 *   - NEXT_PUBLIC_* keys are safe for browser bundles.
 *
 * Sprint ladder:
 *   Required-now  → always validated, hard failure if absent.
 *   Required-later → .optional() today; remove optional() when the sprint lands.
 *
 * Set SKIP_ENV_VALIDATION=1 to bypass (CI builds that run without secrets).
 */
export const env = createEnv({
  // ── Server-side vars (never reach the browser bundle) ───────────────────
  server: {
    // ── Required-now ──────────────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'test', 'production']),

    // ── Required-later: Supabase DB + Auth (Sprint 1) ─────────────────────
    // https://supabase.com/dashboard → Project Settings → API
    // Service role key is server-only — never expose to the client bundle.
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    // Direct Postgres URL for migrations and background jobs.
    DATABASE_URL: z.string().url().optional(),

    // ── Required-later: Stripe billing (Sprint 4) ─────────────────────────
    // https://dashboard.stripe.com/apikeys — use sk_test_ in dev, sk_live_ in prod.
    STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
    // https://dashboard.stripe.com/webhooks — per-endpoint secret.
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

    // ── Required-later: Resend email (Sprint 1–2) ─────────────────────────
    // https://resend.com/api-keys
    RESEND_API_KEY: z.string().startsWith('re_').optional(),
    // "Display Name <from@yourdomain.com>" — must match a verified Resend domain.
    EMAIL_FROM: z.string().email().optional(),

    // ── Required-later: Sentry error tracking (Sprint 1+) ─────────────────
    // https://sentry.io/settings/<org>/projects/<project>/keys/
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),

    // ── Required-later: PostHog analytics + flags (Sprint 1+) ─────────────
    // Server-side personal API key for server-initiated events.
    // https://us.posthog.com/settings/user-api-keys
    POSTHOG_PERSONAL_API_KEY: z.string().optional(),

    // ── Required-later: Upstash Redis + QStash (Sprint 3+) ────────────────
    // https://console.upstash.com — Redis REST endpoint + token.
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    // https://console.upstash.com/qstash — publishing token + signing keys.
    QSTASH_TOKEN: z.string().min(1).optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),

    // ── Required-later: Cloudflare R2 object storage (Sprint 6) ───────────
    // https://dash.cloudflare.com → R2 → Manage API tokens
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),

    // ── Required-later: Anthropic LLM via Vercel AI SDK (Sprint 8) ────────
    // https://console.anthropic.com/settings/keys — starts with sk-ant-
    ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
    // Pin model + token ceiling for production safety. Defaults applied at runtime.
    ANTHROPIC_MODEL: z.string().optional(),
    ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().optional(),
  },

  // ── Client-side vars (NEXT_PUBLIC_* only — safe in browser bundles) ──────
  client: {
    // ── Required-now ──────────────────────────────────────────────────────
    NEXT_PUBLIC_APP_URL: z.string().url(),

    // ── Required-later: Stripe publishable key (Sprint 4) ─────────────────
    // https://dashboard.stripe.com/apikeys — pk_test_ in dev, pk_live_ in prod.
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),

    // ── Required-later: PostHog browser SDK (Sprint 1+) ───────────────────
    // https://us.posthog.com/settings/project — project API key + ingestion host.
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

    // ── Required-later: Sentry browser DSN (Sprint 1+) ────────────────────
    // https://sentry.io/settings/<org>/projects/<project>/keys/
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

    // ── Required-later: R2 public CDN URL (Sprint 6) ──────────────────────
    // The public bucket hostname served via Cloudflare CDN.
    NEXT_PUBLIC_R2_PUBLIC_URL: z.string().url().optional(),

    // ── Required-later: Supabase project URL + publishable key (Sprint 1) ──
    // Both are safe in browser bundles. The service role key stays server-only.
    // https://supabase.com/dashboard → Project Settings → API
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  },

  // ── Manual process.env mapping (required by @t3-oss/env-nextjs) ──────────
  // Every key listed in server/client must appear here.
  runtimeEnv: {
    // server
    NODE_ENV: process.env['NODE_ENV'],
    SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
    DATABASE_URL: process.env['DATABASE_URL'],
    STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'],
    STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'],
    RESEND_API_KEY: process.env['RESEND_API_KEY'],
    EMAIL_FROM: process.env['EMAIL_FROM'],
    SENTRY_DSN: process.env['SENTRY_DSN'],
    SENTRY_ENVIRONMENT: process.env['SENTRY_ENVIRONMENT'],
    POSTHOG_PERSONAL_API_KEY: process.env['POSTHOG_PERSONAL_API_KEY'],
    UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'],
    UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'],
    QSTASH_TOKEN: process.env['QSTASH_TOKEN'],
    QSTASH_CURRENT_SIGNING_KEY: process.env['QSTASH_CURRENT_SIGNING_KEY'],
    QSTASH_NEXT_SIGNING_KEY: process.env['QSTASH_NEXT_SIGNING_KEY'],
    R2_ACCOUNT_ID: process.env['R2_ACCOUNT_ID'],
    R2_ACCESS_KEY_ID: process.env['R2_ACCESS_KEY_ID'],
    R2_SECRET_ACCESS_KEY: process.env['R2_SECRET_ACCESS_KEY'],
    R2_BUCKET: process.env['R2_BUCKET'],
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
    ANTHROPIC_MODEL: process.env['ANTHROPIC_MODEL'],
    ANTHROPIC_MAX_TOKENS: process.env['ANTHROPIC_MAX_TOKENS'],
    // client
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
    NEXT_PUBLIC_POSTHOG_KEY: process.env['NEXT_PUBLIC_POSTHOG_KEY'],
    NEXT_PUBLIC_POSTHOG_HOST: process.env['NEXT_PUBLIC_POSTHOG_HOST'],
    NEXT_PUBLIC_SENTRY_DSN: process.env['NEXT_PUBLIC_SENTRY_DSN'],
    NEXT_PUBLIC_R2_PUBLIC_URL: process.env['NEXT_PUBLIC_R2_PUBLIC_URL'],
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  },

  /**
   * Set SKIP_ENV_VALIDATION=1 to skip validation.
   * Useful in CI builds that run without real secrets (e.g. type-check only jobs).
   */
  skipValidation: process.env['SKIP_ENV_VALIDATION'] === '1',

  /**
   * Treat empty strings as undefined so that unset vars in .env.local
   * (e.g. `SUPABASE_URL=`) are handled correctly by .optional() schemas.
   */
  emptyStringAsUndefined: true,
});
