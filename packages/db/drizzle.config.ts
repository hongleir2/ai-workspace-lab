import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  // Emit snake_case SQL identifiers — matches the casing option in drizzle() client.
  casing: 'snake_case',
  // Only manage the public schema; treat Supabase's auth/storage/realtime schemas as foreign.
  schemaFilter: ['public'],
});
