import { resolve } from 'node:path';
import { config } from 'dotenv';

// Load .env.local then .env from the monorepo root.
config({ path: resolve(import.meta.dirname, '../../../.env.local') });
config({ path: resolve(import.meta.dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Pass "local" as the first CLI arg to target local Supabase.
// Default (no arg) targets the cloud via DATABASE_DIRECT_URL.
const target = process.argv[2];
const isLocal = target === 'local';

const connectionString = isLocal
  ? (process.env['DATABASE_DIRECT_URL_LOCAL'] ??
    'postgresql://postgres:postgres@localhost:54322/postgres')
  : (process.env['DATABASE_DIRECT_URL'] ?? process.env['DATABASE_URL']);

if (!connectionString) {
  throw new Error(
    'DATABASE_DIRECT_URL (cloud) or DATABASE_DIRECT_URL_LOCAL (local) must be set in .env.local',
  );
}

// biome-ignore lint/suspicious/noConsole: migration CLI script
console.log(`Target: ${isLocal ? 'local' : 'cloud'}`);
// biome-ignore lint/suspicious/noConsole: migration CLI script
console.log(`Connecting: ${connectionString.replace(/:\/\/[^@]+@/, '://***@')}`);

const sql = postgres(connectionString, { max: 1, prepare: false });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../migrations') });
await sql.end();
console.warn('migrations applied');
