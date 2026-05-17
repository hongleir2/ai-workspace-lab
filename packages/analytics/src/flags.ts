'use client';

import posthog from 'posthog-js';
import { FLAG_DEFAULTS } from './flag-definitions';
import type { FeatureFlag } from './flag-definitions';

export { FLAG_DEFAULTS, FLAGS } from './flag-definitions';
export type { FeatureFlag } from './flag-definitions';

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (typeof window === 'undefined') return FLAG_DEFAULTS[flag];
  return posthog.isFeatureEnabled(flag) ?? FLAG_DEFAULTS[flag];
}
