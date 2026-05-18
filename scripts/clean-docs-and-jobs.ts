#!/usr/bin/env tsx
/**
 * Deletes all documents, storage_objects, jobs, job_attempts, and document_chunks
 * from either the local Supabase instance or the remote cloud instance.
 *
 * Usage:
 *   pnpm tsx scripts/clean-docs-and-jobs.ts          # local (default)
 *   pnpm tsx scripts/clean-docs-and-jobs.ts --remote  # cloud
 *
 * The --remote flag uses SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 * from your .env.local file (or environment).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

const isRemote = process.argv.includes('--remote');

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0';

const url = isRemote
  ? (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  : LOCAL_URL;

const serviceRoleKey = isRemote
  ? (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')
  : LOCAL_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing Supabase URL or service role key.');
  console.error(
    'For --remote: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

const TABLES = [
  'document_chunks',
  'job_attempts',
  'jobs',
  'documents',
  'storage_objects',
] as const;

async function deleteAll(table: string): Promise<number> {
  // neq with a value that can never match uuid primary key deletes all rows
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    throw new Error(`Failed to delete from ${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function main() {
  const target = isRemote ? 'remote (cloud)' : 'local (localhost:54321)';
  console.log(`Cleaning documents and jobs on ${target}...\n`);

  for (const table of TABLES) {
    try {
      const deleted = await deleteAll(table);
      console.log(`  ${table}: deleted ${deleted} row(s)`);
    } catch (err) {
      console.error(`  ${table}: ERROR — ${(err as Error).message}`);
      process.exit(1);
    }
  }

  console.log('\nDone.');
}

main();
