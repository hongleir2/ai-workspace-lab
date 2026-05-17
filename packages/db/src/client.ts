import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export type Database = PostgresJsDatabase<typeof schema>;

// In development, Next.js HMR re-evaluates this module on every hot reload,
// resetting any module-level variable and creating a new connection pool each
// time. Storing the instance on globalThis (which survives HMR) prevents
// connection pool exhaustion (EMAXCONN) during local development.
declare global {
  var __aiWorkspaceDb: Database | undefined;
}

function resolveDatabase(): Database {
  const existing = globalThis.__aiWorkspaceDb;
  if (existing) return existing;

  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const queryClient = postgres(connectionString, { prepare: false });
  const instance = drizzle(queryClient, { schema, casing: 'snake_case' });
  globalThis.__aiWorkspaceDb = instance;
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const inner = resolveDatabase();
    const value = Reflect.get(inner as object, prop, receiver);
    return typeof value === 'function' ? value.bind(inner) : value;
  },
}) as Database;
