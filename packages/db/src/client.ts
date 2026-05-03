import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Disable prepared statements for Supabase's transaction-mode pooler (PgBouncer).
// PgBouncer in transaction mode does not support the extended query protocol that
// prepared statements require.
const queryClient = postgres(connectionString, { prepare: false });

export const db = drizzle(queryClient, { schema, casing: 'snake_case' });
export type Database = typeof db;
