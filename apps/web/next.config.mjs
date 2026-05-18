import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // tiktoken ships a WASM binary that webpack cannot bundle — let Node resolve it at runtime
  serverExternalPackages: ['tiktoken'],
};

export default withSentryConfig(nextConfig, {
  org: 'leixingtech',
  project: 'ai-workspace-lab',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
