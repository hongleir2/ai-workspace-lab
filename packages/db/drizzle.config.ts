import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: resolve(import.meta.dirname, '../../.env.local') });
config({ path: resolve(import.meta.dirname, '../../.env') });

const databaseUrl = process.env['DATABASE_DIRECT_URL'] ?? process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_DIRECT_URL or DATABASE_URL must be set');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  casing: 'snake_case',
  schemaFilter: ['public'],
});
