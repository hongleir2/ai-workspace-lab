/**
 * Shared types live here as the ai-workspace-lab monorepo grows.
 *
 * Convention: organize by domain (e.g. `auth.ts`, `billing.ts`, `documents.ts`),
 * re-export from this index. Keep types pure — no runtime code.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type OrganizationId = Brand<string, 'OrganizationId'>;
