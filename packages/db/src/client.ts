import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = PostgresJsDatabase<typeof schema>;

let cached: Database | undefined;

function resolveDatabase(): Database {
  if (!cached) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    const queryClient = postgres(connectionString, { prepare: false });
    cached = drizzle(queryClient, { schema, casing: 'snake_case' });
  }
  return cached;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const inner = resolveDatabase();
    const value = Reflect.get(inner as object, prop, receiver);
    return typeof value === 'function' ? value.bind(inner) : value;
  },
}) as Database;
